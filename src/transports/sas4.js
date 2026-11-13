// SAS Radius 4 (Snono Systems) admin API — read-only. Logs in with a manager account and lists
// the open RADIUS sessions (who is online, their IP, MAC, session time and usage).
//
// Protocol, as used by the vendor's own published connector (SnonoSystems/sas4connector-php):
//   base   : http(s)://<host>/admin/api/index.php/api/
//   body   : {"payload": <CryptoJS-style AES of the JSON body>}
//   login  : POST login {username, password, language} -> {status, token}
//   auth   : Authorization: Bearer <token>
//   online : POST index/online {page, count, sortBy, direction, search, columns} -> Laravel paginator
// TowerDesk only ever calls `login` and `index/online`; it changes nothing on the SAS server.
const crypto = require('crypto');

// Not a secret: the fixed passphrase built into the SAS 4 web panel and the vendor's connector.
// It only wraps the request body; the manager password is what actually authenticates.
const API_PASSPHRASE = 'abcdefghijuklmno0123456789012345';
const TIMEOUT_MS = 8000;
const PAGE_SIZE = 500;
const MAX_PAGES = 20; // 10,000 sessions

// OpenSSL EVP_BytesToKey (MD5, one round) -> 32-byte key + 16-byte IV, as CryptoJS does for a
// passphrase. Implemented with node:crypto so no dependency is involved.
function kdf(passphrase, salt) {
  let out = Buffer.alloc(0), block = Buffer.alloc(0);
  while (out.length < 48) {
    block = crypto.createHash('md5').update(Buffer.concat([block, Buffer.from(passphrase, 'utf8'), salt])).digest();
    out = Buffer.concat([out, block]);
  }
  return { key: out.subarray(0, 32), iv: out.subarray(32, 48) };
}
function encrypt(text, passphrase) {
  const salt = crypto.randomBytes(8);
  const { key, iv } = kdf(passphrase || API_PASSPHRASE, salt);
  const c = crypto.createCipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([Buffer.from('Salted__'), salt, c.update(text, 'utf8'), c.final()]).toString('base64');
}
function decrypt(b64, passphrase) {
  const raw = Buffer.from(String(b64), 'base64');
  if (raw.subarray(0, 8).toString() !== 'Salted__') throw new Error('Not a salted payload');
  const { key, iv } = kdf(passphrase || API_PASSPHRASE, raw.subarray(8, 16));
  const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([d.update(raw.subarray(16)), d.final()]).toString('utf8');
}

// "sas.example.com", "10.0.0.5:8080" or a full "https://…" address -> candidate API base URLs.
// With no scheme given, HTTPS is tried first and plain HTTP second (many SAS panels are HTTP).
function baseUrls(host) {
  const h = String(host || '').trim().replace(/\/+$/, '').replace(/\/admin(\/.*)?$/i, '');
  if (!h) return [];
  const suffix = '/admin/api/index.php/api/';
  return /^https?:\/\//i.test(h) ? [h + suffix] : ['https://' + h + suffix, 'http://' + h + suffix];
}

async function call(base, route, body, token) {
  const res = await fetch(base + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + (token || '') },
    body: JSON.stringify({ payload: encrypt(JSON.stringify(body || {})) }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* not JSON */ }
  return { status: res.status, json };
}

class Sas4Session {
  constructor(base, token) { this.base = base; this.token = token; this.openedAt = Date.now(); }

  // Throws an Error whose message is safe to show (never contains the password).
  static async login({ host, username, password }) {
    const bases = baseUrls(host);
    if (!bases.length) throw new Error('No SAS 4 address set.');
    let lastErr = null;
    for (const base of bases) {
      let r;
      try {
        r = await call(base, 'login', { username: username || '', password: password || '', language: 'en' });
      } catch (e) {
        lastErr = new Error('Could not reach SAS 4 at ' + base.replace(/\/admin\/.*$/, '') + '.');
        continue; // try the next scheme
      }
      const token = r.json && r.json.token;
      if (token) return new Sas4Session(base, token);
      if (r.status === 404 || !r.json) { lastErr = new Error('That address does not look like a SAS 4 panel.'); continue; }
      throw Object.assign(new Error('SAS 4 rejected the login — check the manager username and password.'), { auth: true });
    }
    throw lastErr;
  }

  async post(route, body) {
    const r = await call(this.base, route, body, this.token);
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('SAS 4 session expired.'), { expired: true });
    if (r.status < 200 || r.status >= 400 || !r.json) throw new Error('SAS 4 answered HTTP ' + r.status + '.');
    return r.json;
  }

  // Every open RADIUS session (paged).
  async online() {
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const j = await this.post('index/online', {
        page, count: PAGE_SIZE, sortBy: 'username', direction: 'asc', search: '',
        columns: ['id', 'username', 'acctoutputoctets', 'acctinputoctets', 'user_profile_name', 'framedipaddress', 'callingstationid', 'acctsessiontime', 'oui']
      });
      const data = Array.isArray(j.data) ? j.data : [];
      rows.push(...data);
      if (!data.length || page >= (Number(j.last_page) || 1)) break;
    }
    return rows;
  }

  // Every account (paged), online or not — used to show offline subscribers too.
  async users() {
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const j = await this.post('index/user', {
        page, count: PAGE_SIZE, sortBy: 'id', direction: 'asc', search: '',
        columns: ['id', 'username', 'firstname', 'lastname', 'expiration', 'phone', 'last_online', 'name']
      });
      const data = Array.isArray(j.data) ? j.data : [];
      rows.push(...data);
      if (data.length < PAGE_SIZE || page >= (Number(j.last_page) || 1)) break;
    }
    return rows;
  }
}

// Pure: one index/user row -> account details. `name` is the profile name in SAS 4's user list;
// `profile_details` (returned regardless of the columns asked for) carries it too.
function mapUser(row) {
  const pd = row.profile_details && typeof row.profile_details === 'object' ? row.profile_details : {};
  const full = [row.firstname, row.lastname].filter(Boolean).join(' ').trim();
  return {
    id: 'sas4-u' + (row.id !== undefined ? row.id : row.username),
    username: row.username || '',
    name: full || row.username || '',
    plan: pd.name || row.name || row.profile_name || 'SAS 4',
    online: row.online_status === 1 || row.online_status === true || row.online_status === '1',
    enabled: !(row.enabled === 0 || row.enabled === false || row.enabled === '0'),
    expiration: row.expiration || null,
    phone: row.phone || null,
    lastOnline: row.last_online || null
  };
}

function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }

// Pure: one index/online row -> the fields TowerDesk's subscriber shape needs. In RADIUS
// accounting "output" is what the NAS sent to the user (download) and "input" is upload.
function mapSession(row) {
  const user = row.username || '';
  const full = [row.firstname, row.lastname].filter(Boolean).join(' ').trim();
  return {
    id: 'sas4-' + (row.id !== undefined ? row.id : user),
    username: user,
    name: row.name || full || user,
    plan: row.user_profile_name || row.profile_name || 'SAS 4',
    framedIp: row.framedipaddress || null,
    mac: row.callingstationid || null,
    nas: row.nasipaddress || row.nas_name || null,
    sessionSeconds: n(row.acctsessiontime) || 0,
    bytesDown: n(row.acctoutputoctets),
    bytesUp: n(row.acctinputoctets)
  };
}

module.exports = { Sas4Session, mapSession, mapUser, encrypt, decrypt, baseUrls, API_PASSPHRASE };
