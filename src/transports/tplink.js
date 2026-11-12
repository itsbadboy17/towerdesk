// TP-Link web-UI connector for the newer "/webpages/" firmware (e.g. Archer AX12 v1, fw 1.10.x).
// The protocol below was taken from the router's own web UI code, not guessed:
//   1. POST /cgi-bin/luci/;stok=/device_config?form=config  (public) -> feature flags ("certification")
//   2. POST .../login?form=keys  (public) -> RSA key for the password
//   3. POST .../login?form=auth  (public) -> RSA key for signatures + sequence number
//   4. POST .../login?form=login with {sign, data}:
//        data = AES-128-CBC(PKCS7, key/iv = 16 random digits) of "operation=login&password=<rsa>&confirm=false"
//        password = RSA PKCS#1 v1.5 (password key), hex padded to key length
//        sign = "k=<key>&i=<iv>&h=<hash>&s=<seq + data.length>" in 53-char chunks, each RSA-encrypted
//               (OAEP/SHA-1 when the firmware has the SG CLS L1 flag, else PKCS#1 v1.5)
//        hash = SHA256("admin" + password) (or MD5 on firmware without the SHA256 flag)
//      Response {data} is AES-encrypted JSON with data.stok; a session cookie is set.
//   5. Later requests: data = AES(form), sign = "h=<hash>&s=<seq+len>" chunks, HMAC-SHA256 with
//      "k=..&i=.." as key (GDPR flag), and hash = SHA256(data) per request (REPLACE_HASH flag).
// Only read operations are used. confirm=false means TowerDesk never kicks an admin already
// logged in to the router's web page; it reports "busy" instead.
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const { DEFAULT_TIMEOUT, friendlyError } = require('./common');

const FLAG = {
  SHA256: ['IMDA TS RG-SEC', 'SG CLS L1 STAGE2', 'EU CE RED', 'Brazil ANATEL'],
  GDPR: ['SG CLS L1 STAGE2', 'EU CE RED', 'Brazil ANATEL'],
  REPLACE_HASH: ['SG CLS L1 STAGE2'],
  OAEP: ['SG CLS L1 STAGE2']
};

// ---------- small crypto helpers (RSA done with BigInt so 512-bit device keys always work) ----------
const toBig = (hex) => BigInt('0x' + hex);
function modPow(b, e, m) {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}
function rsaRaw(em, nHex, eHex) {
  const k = Math.ceil(nHex.replace(/^0+/, '').length / 2);
  const c = modPow(toBig(em.toString('hex')), toBig(eHex), toBig(nHex));
  return c.toString(16).padStart(k * 2, '0');
}
function keyBytes(nHex) { return Math.ceil(nHex.replace(/^0+/, '').length / 2); }

function rsaPkcs1(msg, nHex, eHex) {
  const m = Buffer.from(msg, 'utf8');
  const k = keyBytes(nHex);
  if (m.length > k - 11) throw new Error('RSA message too long');
  const ps = Buffer.alloc(k - m.length - 3);
  for (let i = 0; i < ps.length; i++) { let b = 0; while (!b) b = crypto.randomBytes(1)[0]; ps[i] = b; }
  return rsaRaw(Buffer.concat([Buffer.from([0, 2]), ps, Buffer.from([0]), m]), nHex, eHex).padStart(nHex.length, '0');
}

function mgf1(seed, len) {
  const out = [];
  for (let c = 0; Buffer.concat(out).length < len; c++) {
    const cnt = Buffer.alloc(4);
    cnt.writeUInt32BE(c);
    out.push(crypto.createHash('sha1').update(Buffer.concat([seed, cnt])).digest());
  }
  return Buffer.concat(out).subarray(0, len);
}
function oaepBlock(m, nHex, eHex) {
  const k = keyBytes(nHex), hLen = 20;
  const lHash = crypto.createHash('sha1').update('').digest();
  const db = Buffer.concat([lHash, Buffer.alloc(k - m.length - 2 * hLen - 2), Buffer.from([1]), m]);
  const seed = crypto.randomBytes(hLen);
  const dbMask = mgf1(seed, db.length);
  const maskedDb = Buffer.from(db.map((b, i) => b ^ dbMask[i]));
  const seedMask = mgf1(maskedDb, hLen);
  const maskedSeed = Buffer.from(seed.map((b, i) => b ^ seedMask[i]));
  return rsaRaw(Buffer.concat([Buffer.from([0]), maskedSeed, maskedDb]), nHex, eHex);
}
// Like the UI: UTF-8 bytes, split into (k - 42)-byte pieces, each OAEP-encrypted, hex concatenated.
function rsaOaep(msg, nHex, eHex) {
  const bytes = Buffer.from(msg, 'utf8');
  const max = keyBytes(nHex) - 42;
  let out = '';
  for (let i = 0; i < bytes.length; i += max) out += oaepBlock(bytes.subarray(i, i + max), nHex, eHex);
  return out;
}

function digits(n) { let s = ''; while (s.length < n) s += String(crypto.randomInt(0, 10)); return s; }
function aesEncrypt(text, key, iv) {
  const c = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  return Buffer.concat([c.update(text, 'utf8'), c.final()]).toString('base64');
}
function aesDecrypt(b64, key, iv) {
  const d = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
  return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8');
}
function form(obj) {
  return Object.keys(obj).filter((k) => obj[k] !== undefined && obj[k] !== null)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : obj[k])).join('&');
}

// ---------- HTTP ----------
function post({ host, port, secure, timeout }, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const lib = secure ? https : http;
    const req = lib.request({
      host, port, method: 'POST', path: '/cgi-bin/luci/;stok=' + path,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        Referer: `${secure ? 'https' : 'http'}://${host}/webpages/index.html`,
        ...(cookie ? { Cookie: cookie } : {})
      },
      rejectUnauthorized: false,
      timeout
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        try { if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw); } catch (e) { /* plain */ }
        let json = null;
        try { json = JSON.parse(raw.toString('utf8')); } catch (e) { /* not JSON */ }
        resolve({ status: res.statusCode, json, setCookie: res.headers['set-cookie'] || [] });
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end(body);
  });
}

class TplinkError extends Error {
  constructor(message, kind, extra) { super(message); this.kind = kind; Object.assign(this, extra); }
}

class TplinkSession {
  // Logs in. Rejects with TplinkError kind 'auth' | 'busy' | 'locked' | 'protocol'.
  static async open({ host, port, secure, password, timeout = DEFAULT_TIMEOUT }) {
    const conn = { host, port: port || (secure ? 443 : 80), secure: !!secure, timeout };
    const cfg = await post(conn, '/device_config?form=config', 'operation=read');
    const data = (cfg.json && cfg.json.data) || {};
    const cert = (data.features && data.features.certification) || data.certification || [];
    const has = (list) => cert.some((c) => list.includes(c));
    const flags = { sha256: has(FLAG.SHA256), gdpr: has(FLAG.GDPR), replaceHash: has(FLAG.REPLACE_HASH), oaep: has(FLAG.OAEP) };

    const keys = await post(conn, '/login?form=keys', 'operation=read');
    const auth = await post(conn, '/login?form=auth', 'operation=read');
    const pwKey = keys.json && keys.json.data && keys.json.data.password;
    const sigKey = auth.json && auth.json.data && auth.json.data.key;
    const seq = auth.json && auth.json.data && Number(auth.json.data.seq);
    if (!Array.isArray(pwKey) || !Array.isArray(sigKey) || !seq) {
      throw new TplinkError('This TP-Link firmware does not use the supported login', 'protocol');
    }

    const s = new TplinkSession(conn, flags, sigKey, seq);
    s.hash = crypto.createHash(flags.sha256 ? 'sha256' : 'md5').update('admin' + (password || '')).digest('hex');
    const encPassword = rsaPkcs1(password || '', pwKey[0], pwKey[1]);
    const res = await s.send('/login?form=login', { operation: 'login', password: encPassword, confirm: false }, true);
    if (res.success === false) {
      const code = String(res.errorCode || res.errorcode || res.error_code || (res.data && res.data.errorcode) || '');
      const d = res.data || {};
      if (/conflict|multiple/i.test(code)) throw new TplinkError('Someone is logged in to the router web page right now', 'busy');
      if (/max attempt/i.test(code)) throw new TplinkError('Router locked the login after too many attempts — wait and try later', 'locked');
      const left = d.attemptsAllowed !== undefined ? ` (${d.attemptsAllowed} attempts left before the router locks)` : '';
      throw new TplinkError('Wrong router password' + left, 'auth');
    }
    s.stok = res.data && res.data.stok;
    if (!s.stok) throw new TplinkError('Login reply had no session token', 'protocol');
    return s;
  }

  constructor(conn, flags, sigKey, seq) {
    this.conn = conn;
    this.flags = flags;
    this.sigKey = sigKey;
    this.seq = seq;
    this.aesKey = digits(16);
    this.aesIv = digits(16);
    this.cookie = '';
    this.stok = '';
    this.closed = false;
  }

  sign(dataLen, withAesKey) {
    const formatted = `k=${this.aesKey}&i=${this.aesIv}`;
    let text = `h=${this.hash}&s=${this.seq + dataLen}`;
    if (withAesKey) text = `${formatted}&${text}`;
    let out = '';
    for (let i = 0; i < text.length; i += 53) {
      const chunk = text.substring(i, i + 53);
      if (withAesKey || !this.flags.gdpr) {
        out += this.flags.oaep ? rsaOaep(chunk, this.sigKey[0], this.sigKey[1]) : rsaPkcs1(chunk, this.sigKey[0], this.sigKey[1]);
      } else {
        out += crypto.createHmac('sha256', formatted).update(chunk).digest('hex');
      }
    }
    return out;
  }

  async send(path, params, withAesKey = false) {
    if (this.closed) throw new TplinkError('Session closed', 'expired');
    const data = aesEncrypt(form(params || {}), this.aesKey, this.aesIv);
    if (this.flags.replaceHash && !withAesKey && this.stok) this.hash = crypto.createHash('sha256').update(data).digest('hex');
    const body = form({ sign: this.sign(data.length, withAesKey), data });
    const res = await post(this.conn, (this.stok || '') + path, body, this.cookie);
    for (const c of res.setCookie) {
      const kv = c.split(';')[0];
      if (/^sysauth=/i.test(kv)) this.cookie = kv;
    }
    if (res.status === 403 || res.status === 401) { this.closed = true; throw new TplinkError('Router session expired', 'expired'); }
    if (!res.json) throw new TplinkError('Unexpected reply from router (HTTP ' + res.status + ')', 'protocol');
    let out = res.json;
    if (typeof out.data === 'string') {
      try { out = JSON.parse(aesDecrypt(out.data, this.aesKey, this.aesIv)); } catch (e) {
        this.closed = true;
        throw new TplinkError('Could not decrypt router reply (session expired?)', 'expired');
      }
    }
    if (out.errorcode === 'timeout' || out.errorCode === 'timeout') { this.closed = true; throw new TplinkError('Router session expired', 'expired'); }
    return out;
  }

  async read(path, operation = 'read') {
    const r = await this.send(path, { operation });
    if (r.success === false) throw new TplinkError('Router refused ' + path + ': ' + (r.errorcode || r.errorCode || 'error'), 'protocol');
    return r.data;
  }

  async logout() {
    if (this.closed) return;
    try { await this.send('/admin/system?form=logout', {}); } catch (e) { /* best effort */ }
    this.closed = true;
  }
}

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n <= 1 ? n * 100 : n);
}

function listFrom(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    for (const v of Object.values(d)) if (Array.isArray(v)) return v;
    const vals = Object.values(d);
    if (vals.length && vals.every((v) => v && typeof v === 'object')) return vals;
  }
  return [];
}

// System status (CPU/RAM/WAN) + connected clients with live speeds (bytes/s from the router).
async function readStats(session) {
  const status = await session.read('/admin/status?form=all');
  let clients = [];
  try {
    const raw = await session.read('/admin/smart_network?form=game_accelerator', 'loadDevice');
    clients = listFrom(raw)
      .filter((c) => c && c.deviceTag !== 'offline' && c.ip !== '0.0.0.0')
      .map((c) => ({
        name: String(c.deviceName || c.name || c.mac || 'device'),
        mac: c.mac,
        ip: c.ip,
        type: c.deviceType,
        link: c.deviceTag,
        downBytes: Number(c.downloadSpeed) || 0,
        upBytes: Number(c.uploadSpeed) || 0
      }));
  } catch (e) {
    clients = null; // feature missing on this firmware
  }
  const s = status || {};
  return {
    cpu: pct(s.cpu_usage),
    mem: pct(s.mem_usage),
    wanIp: s.wan_ipv4_ipaddr,
    wanUptime: s.wan_ipv4_uptime,
    clients
  };
}

function loginErrorMessage(err) {
  if (err instanceof TplinkError) return err.message;
  return friendlyError(err);
}

// One-shot check for "Test connection": log in, read status, log out.
async function test({ host, port, secure, password, timeout }) {
  let s;
  try {
    s = await TplinkSession.open({ host, port, secure, password, timeout });
    const st = await readStats(s);
    const n = st.clients ? st.clients.length : null;
    return {
      ok: true,
      vendor: 'tplink',
      summary: 'Router login OK' + (n !== null ? ` · ${n} device${n === 1 ? '' : 's'} connected` : ''),
      details: { cpu: st.cpu !== undefined ? st.cpu + '%' : undefined, memory: st.mem !== undefined ? st.mem + '%' : undefined, wanIp: st.wanIp, clients: n }
    };
  } catch (err) {
    return { ok: false, error: loginErrorMessage(err), errorKind: err.kind };
  } finally {
    if (s) await s.logout();
  }
}

module.exports = { TplinkSession, TplinkError, readStats, test, _internals: { rsaPkcs1, rsaOaep, aesEncrypt, aesDecrypt, form } };
