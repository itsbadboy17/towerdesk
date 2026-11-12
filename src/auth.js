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

const sessions = new Map(); // token -> { user, expires }
const failures = new Map(); // client key -> { count, until }

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')).users || {};
  } catch (e) {
    return {};
  }
}

function isConfigured() {
  return Object.keys(loadUsers()).length > 0;
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function setUser(username, password) {
  const users = loadUsers();
  users[username] = hashPassword(password);
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ users }, null, 2), { mode: 0o600 });
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
  sessions.set(token, { user: String(username), expires: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieFlags(req)}`);
  res.json({ success: true, user: String(username) });
}

function logout(req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieFlags(req)}`);
  res.json({ success: true });
}

// Paths reachable without a session (the login page and what it needs).
const PUBLIC = new Set(['/login', '/api/login', '/app.css', '/app.js', '/login.js']);

// Auth is enforced once a password has been set (npm run set-password),
// unless TOWERDESK_AUTH=off is set for local automated testing.
function middleware(req, res, next) {
  if (process.env.TOWERDESK_AUTH === 'off' || !isConfigured()) return next();
  if (PUBLIC.has(req.path)) return next();
  const s = getSession(req);
  if (s) { req.user = s.user; return next(); }
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Login required' });
  const nextUrl = req.originalUrl && req.originalUrl !== '/' ? '?next=' + encodeURIComponent(req.originalUrl) : '';
  return res.redirect('/login' + nextUrl);
}

module.exports = { middleware, login, logout, setUser, isConfigured, getSession };
