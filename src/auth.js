// TowerDesk login: scrypt-hashed passwords on disk, random session tokens in memory.
// Passwords and tokens are never logged or sent to the UI.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { dataDir } = require('./paths');

const AUTH_FILE = path.join(dataDir(), 'auth.json');
const COOKIE = 'td_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const sessions = new Map(); // token -> { user, role, expires }
const ROLES = ['admin', 'tech', 'viewer'];
const failures = new Map(); // client key -> { count, until }

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')).users || {};
  } catch (e) {
    return {};
  }
}
function saveUsers(users) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ users }, null, 2), { mode: 0o600 });
}
// Accounts made before roles existed are admins.
function roleOf(username) {
  const rec = loadUsers()[username];
  return rec ? (ROLES.includes(rec.role) ? rec.role : 'admin') : null;
}

function isConfigured() {
  return Object.keys(loadUsers()).length > 0;
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

// Create or change an account (the command line uses this). An existing account keeps its role.
function setUser(username, password, role) {
  const users = loadUsers();
  const prev = users[username];
  users[username] = Object.assign(hashPassword(password), { role: ROLES.includes(role) ? role : (prev && ROLES.includes(prev.role) ? prev.role : 'admin'), created: prev && prev.created ? prev.created : new Date().toISOString() });
  saveUsers(users);
  // Existing sessions for this user are no longer valid after a password change.
  for (const [token, s] of sessions) if (s.user === username) sessions.delete(token);
}

function verify(username, password) {
  const rec = loadUsers()[username];
  // Hash even for unknown users so timing does not reveal which usernames exist.
  const { hash } = hashPassword(String(password || ''), rec ? rec.salt : 'no-such-user-salt');
  if (!rec) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(rec.hash, 'hex'));
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function clientKey(req) {
  // Behind a tunnel every request comes from localhost, so prefer the forwarded client address.
  return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim();
}

function getSession(req) {
  const token = parseCookies(req)[COOKIE];
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return s;
}

function cookieFlags(req) {
  const https = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return `Path=/; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`;
}

function login(req, res) {
  const key = clientKey(req);
  const f = failures.get(key);
  if (f && f.until > Date.now()) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }
  const { username, password } = req.body || {};
  if (!verify(String(username || ''), password)) {
    const lockExpired = f && f.until && f.until <= Date.now();
    const count = (f && !lockExpired ? f.count : 0) + 1;
    failures.set(key, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  failures.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: String(username), role: roleOf(String(username)) || 'admin', expires: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieFlags(req)}`);
  res.json({ success: true, user: String(username) });
}

// Sign someone in without a password check (used once: right after the first account is created).
function startSession(req, res, username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: username, role: roleOf(username) || 'admin', expires: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieFlags(req)}`);
  return { signedIn: true };
}

function logout(req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
  res.json({ success: true });
}

// What each role may do. Admin: everything. Technician: devices, monitoring and the advisor, but not staff,
// settings, saved logins, backups, updates or money. Viewer: look, ping and trace only.
const ADMIN_PREFIX = ['/api/users', '/api/credentials', '/api/update', '/api/ai/config', '/api/radius/config', '/api/backup', '/api/restore', '/api/finance', '/api/notify'];
const ADMIN_PAGES = new Set(['/settings', '/settings.html', '/finance', '/finance.html']);
const VIEWER_POST_OK = [/^\/api\/logout$/, /^\/api\/tools\//];
function canAccess(role, method, p) {
  if (role === 'admin') return true;
  const adminOnly = ADMIN_PAGES.has(p) || ADMIN_PREFIX.some((x) => p === x || p.startsWith(x + '/'));
  if (adminOnly) return false;
  if (role === 'tech') return true;
  // Customer names and phone numbers are for staff who act on them, not for viewers.
  if (role === 'viewer' && p.startsWith('/api/messages')) return false;
  if (role === 'viewer') return method === 'GET' || method === 'HEAD' || VIEWER_POST_OK.some((r) => r.test(p));
  return false;
}

// Staff accounts (never returns hashes).
function listUsers() {
  const users = loadUsers();
  return Object.keys(users).sort().map((name) => ({ username: name, role: roleOf(name), created: users[name].created || null }));
}
function validName(n) { return /^[A-Za-z0-9._-]{2,32}$/.test(String(n || '')); }
function adminCount(users) { return Object.keys(users).filter((n) => (ROLES.includes(users[n].role) ? users[n].role : 'admin') === 'admin').length; }
function createUser(username, password, role) {
  username = String(username || '').trim();
  if (!validName(username)) return { error: 'Use 2 to 32 letters, numbers, dots, dashes or underscores for the username.' };
  if (String(password || '').length < 8) return { error: 'The password must be at least 8 characters.' };
  if (!ROLES.includes(role)) return { error: 'Choose a role: admin, technician or viewer.' };
  const users = loadUsers();
  if (users[username]) return { error: 'That username is already taken.' };
  // The first account is always an admin, or nobody could manage the others.
  if (!Object.keys(users).length) role = 'admin';
  setUser(username, password, role);
  return { ok: true, username, role };
}
function updateUser(username, patch) {
  const users = loadUsers();
  const rec = users[username];
  if (!rec) return { error: 'No such account.' };
  patch = patch || {};
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) return { error: 'Choose a role: admin, technician or viewer.' };
    const wasAdmin = roleOf(username) === 'admin';
    if (wasAdmin && patch.role !== 'admin' && adminCount(users) <= 1) return { error: 'There must be at least one admin.' };
    rec.role = patch.role;
    saveUsers(users);
    for (const [, sess] of sessions) if (sess.user === username) sess.role = patch.role;
  }
  if (patch.password !== undefined) {
    if (String(patch.password).length < 8) return { error: 'The password must be at least 8 characters.' };
    setUser(username, String(patch.password));
  }
  return { ok: true };
}
function removeUser(username, actingUser) {
  const users = loadUsers();
  if (!users[username]) return { error: 'No such account.' };
  if (username === actingUser) return { error: 'You cannot delete the account you are signed in with.' };
  if (roleOf(username) === 'admin' && adminCount(users) <= 1) return { error: 'There must be at least one admin.' };
  delete users[username];
  saveUsers(users);
  for (const [token, sess] of sessions) if (sess.user === username) sessions.delete(token);
  return { ok: true };
}

// Paths reachable without a session (the login page and what it needs).
const PUBLIC = new Set(['/login', '/api/login', '/app.css', '/app.js', '/login.js', '/design-b.css']);

// Auth is enforced once a password has been set (npm run set-password),
// unless TOWERDESK_AUTH=off is set for local automated testing.
function middleware(req, res, next) {
  if (process.env.TOWERDESK_AUTH === 'off' || !isConfigured()) return next();
  if (PUBLIC.has(req.path)) return next();
  const s = getSession(req);
  if (s) {
    req.user = s.user;
    req.role = roleOf(s.user) || s.role || 'admin';
    if (!canAccess(req.role, req.method, req.path)) {
      if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Your account is not allowed to do this.' });
      return res.redirect('/');
    }
    return next();
  }
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Login required' });
  const nextUrl = req.originalUrl && req.originalUrl !== '/' ? '?next=' + encodeURIComponent(req.originalUrl) : '';
  return res.redirect('/login' + nextUrl);
}

module.exports = { verify, middleware, login, logout, startSession, setUser, isConfigured, getSession, roleOf, canAccess, listUsers, createUser, updateUser, removeUser, ROLES };
