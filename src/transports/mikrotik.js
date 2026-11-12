// MikroTik RouterOS API client (port 8728, or 8729 with TLS). Read-only: logs in and reads
// /system/identity and /system/resource. Supports post-6.43 and legacy challenge logins.
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { DEFAULT_TIMEOUT, friendlyError } = require('./common');

function encodeLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) return Buffer.from([(len >> 8) | 0x80, len & 0xff]);
  if (len < 0x200000) return Buffer.from([(len >> 16) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  if (len < 0x10000000) return Buffer.from([(len >>> 24) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.from([0xf0, (len >>> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
}

function encodeSentence(words) {
  const parts = [];
  for (const w of words) {
    const b = Buffer.from(w, 'utf8');
    parts.push(encodeLength(b.length), b);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

// Returns { len, size } or null if more bytes are needed.
function decodeLength(buf, i) {
  if (i >= buf.length) return null;
  const c = buf[i];
  if ((c & 0x80) === 0) return { len: c, size: 1 };
  if ((c & 0xc0) === 0x80) return i + 1 < buf.length ? { len: ((c & 0x3f) << 8) | buf[i + 1], size: 2 } : null;
  if ((c & 0xe0) === 0xc0) return i + 2 < buf.length ? { len: ((c & 0x1f) << 16) | (buf[i + 1] << 8) | buf[i + 2], size: 3 } : null;
  if ((c & 0xf0) === 0xe0) return i + 3 < buf.length ? { len: ((c & 0x0f) * 0x1000000) + (buf[i + 1] << 16) + (buf[i + 2] << 8) + buf[i + 3], size: 4 } : null;
  return i + 4 < buf.length ? { len: buf.readUInt32BE(i + 1), size: 5 } : null;
}

// Pull complete sentences out of a buffer. Returns { sentences, rest }.
function parseSentences(buf) {
  const sentences = [];
  let i = 0;
  let start = 0;
  let words = [];
  while (true) {
    const l = decodeLength(buf, i);
    if (!l) break;
    if (l.len === 0) {
      i += l.size;
      sentences.push(words);
      words = [];
      start = i;
      continue;
    }
    if (i + l.size + l.len > buf.length) break;
    words.push(buf.slice(i + l.size, i + l.size + l.len).toString('utf8'));
    i += l.size + l.len;
  }
  return { sentences, rest: buf.slice(start) };
}

function attrs(sentence) {
  const o = {};
  for (const w of sentence) {
    const m = w.match(/^=([^=]+)=(.*)$/s);
    if (m) o[m[1]] = m[2];
  }
  return o;
}

class ApiClient {
  constructor(sock) {
    this.sock = sock;
    this.buf = Buffer.alloc(0);
    this.waiting = null;
    this.replies = [];
    sock.on('data', (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      const { sentences, rest } = parseSentences(this.buf);
      this.buf = rest;
      for (const s of sentences) this.onSentence(s);
    });
  }

  onSentence(s) {
    if (!this.waiting) return;
    const type = s[0];
    if (type === '!re') this.replies.push(attrs(s));
    if (type === '!done' || type === '!trap' || type === '!fatal') {
      const w = this.waiting;
      const replies = this.replies;
      this.waiting = null;
      this.replies = [];
      if (type === '!done') w.resolve({ replies, done: attrs(s) });
      else w.reject(new Error(attrs(s).message || (type === '!fatal' ? s[1] : 'Command failed')));
    }
  }

  run(words) {
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject };
      this.sock.write(encodeSentence(words));
    });
  }

  async login(username, password) {
    const r = await this.run(['/login', '=name=' + username, '=password=' + password]);
    if (r.done.ret) {
      // Legacy (pre-6.43) challenge-response login.
      const challenge = Buffer.from(r.done.ret, 'hex');
      const md5 = crypto.createHash('md5').update(Buffer.concat([Buffer.from([0]), Buffer.from(password, 'utf8'), challenge])).digest('hex');
      await this.run(['/login', '=name=' + username, '=response=00' + md5]);
    }
  }
}

function isAuthError(err) {
  return /invalid user|password|cannot log in|not logged in/i.test(err && err.message);
}

// A logged-in API connection that can run several commands (used for live polling, so the
// router logs one login instead of one per poll).
class Session {
  static open({ host, port, username, password, secure, timeout = DEFAULT_TIMEOUT }) {
    port = port || (secure ? 8729 : 8728);
    return new Promise((resolve, reject) => {
      const opts = { host, port };
      const sock = secure ? tls.connect({ ...opts, rejectUnauthorized: false }) : net.connect(opts);
      let done = false;
      const fail = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        sock.destroy();
        reject(err);
      };
      const timer = setTimeout(() => fail(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), timeout);
      sock.on('error', fail);
      sock.once(secure ? 'secureConnect' : 'connect', () => {
        const api = new ApiClient(sock);
        api.login(username || 'admin', password || '').then(() => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(new Session(sock, api, timeout));
        }, fail);
      });
    });
  }

  constructor(sock, api, timeout) {
    this.sock = sock;
    this.api = api;
    this.timeout = timeout;
    this.closed = false;
    sock.on('close', () => { this.closed = true; });
    sock.on('error', () => { this.closed = true; });
  }

  // Run one command; rejects on trap or if the router doesn't answer in time.
  run(words) {
    if (this.closed) return Promise.reject(new Error('Session closed'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.close(); reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })); }, this.timeout);
      this.api.run(words).then((r) => { clearTimeout(timer); resolve(r.replies); }, (e) => { clearTimeout(timer); reject(e); });
    });
  }

  close() {
    this.closed = true;
    this.sock.destroy();
  }
}

function num(v) {
  return v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
}

async function readSystem(session) {
  const identity = await session.run(['/system/identity/print']);
  const resource = await session.run(['/system/resource/print']);
  const r = resource[0] || {};
  return {
    identity: (identity[0] || {}).name,
    board: r['board-name'],
    version: r.version,
    uptime: r.uptime,
    cpuLoad: num(r['cpu-load']),
    freeMemory: num(r['free-memory']),
    totalMemory: num(r['total-memory'])
  };
}

// Byte counters per interface (read-only).
async function readInterfaces(session) {
  const rows = await session.run(['/interface/print', '=.proplist=name,type,running,disabled,rx-byte,tx-byte']);
  return rows.map((r) => ({
    name: r.name,
    type: r.type,
    up: r.running === 'true' && r.disabled !== 'true',
    rxBytes: num(r['rx-byte']),
    txBytes: num(r['tx-byte'])
  })).filter((i) => i.name && i.rxBytes !== undefined);
}

// Turn on SNMP and make sure the given read-only community exists. This WRITES to the router
// (the only non-read-only operation in TowerDesk) and needs an API user with write permission.
// It never changes the community's address restrictions and never removes anything.
async function enableSnmp(session, { community = 'public' } = {}) {
  const existing = await session.run(['/snmp/community/print', '=.proplist=name']);
  const names = existing.map((c) => c.name);
  let added = false;
  if (!names.includes(community)) {
    await session.run(['/snmp/community/add', '=name=' + community, '=read-access=yes']);
    added = true;
  } else {
    // Make sure it can read (don't touch addresses or anything else).
    await session.run(['/snmp/community/set', '=numbers=' + community, '=read-access=yes', '=disabled=no']);
  }
  await session.run(['/snmp/set', '=enabled=yes']);
  return { community, added };
}

async function test(opts) {
  let session;
  try {
    session = await Session.open(opts);
    const d = await readSystem(session);
    return {
      ok: true,
      vendor: 'mikrotik',
      summary: `RouterOS ${d.version || '?'} on ${d.board || 'unknown board'}`,
      details: d
    };
  } catch (err) {
    return { ok: false, error: isAuthError(err) ? 'Wrong username or password' : friendlyError(err) };
  } finally {
    if (session) session.close();
  }
}

module.exports = { test, Session, readSystem, readInterfaces, enableSnmp, isAuthError, encodeSentence, parseSentences };
