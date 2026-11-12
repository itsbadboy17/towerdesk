// A fake TP-Link "/webpages/" router that implements the server side of the login protocol
// (decrypts the RSA password and signature, checks the hash, encrypts replies). Used by tests.
const http = require('http');
const crypto = require('crypto');

function rsaKey(bits) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: bits, publicExponent: 65537 });
  const jwk = publicKey.export({ format: 'jwk' });
  const n = Buffer.from(jwk.n, 'base64url').toString('hex');
  return { privateKey, n, e: '010001' };
}

// Node blocks PKCS#1 v1.5 private decryption, so the fake does textbook RSA + unpadding itself.
function pkcs1Decrypt(hex, key) {
  const jwk = key.privateKey.export({ format: 'jwk' });
  const big = (b64) => BigInt('0x' + Buffer.from(b64, 'base64url').toString('hex'));
  const n = big(jwk.n), d = big(jwk.d);
  let r = 1n, b = BigInt('0x' + hex) % n, e = d;
  while (e > 0n) { if (e & 1n) r = (r * b) % n; b = (b * b) % n; e >>= 1n; }
  const em = Buffer.from(r.toString(16).padStart(Buffer.from(jwk.n, 'base64url').length * 2, '0'), 'hex');
  if (em[0] !== 0 || em[1] !== 2) throw new Error('bad PKCS#1 padding');
  return em.subarray(em.indexOf(0, 2) + 1).toString('utf8');
}

function decryptHexChunks(hex, key, padding, chunkHex) {
  if (padding === crypto.constants.RSA_PKCS1_PADDING) {
    let out = '';
    for (let i = 0; i < hex.length; i += chunkHex) out += pkcs1Decrypt(hex.slice(i, i + chunkHex), key);
    return out;
  }
  let out = '';
  for (let i = 0; i < hex.length; i += chunkHex) {
    out += crypto.privateDecrypt({ key: key.privateKey, padding, oaepHash: 'sha1' }, Buffer.from(hex.slice(i, i + chunkHex), 'hex')).toString('utf8');
  }
  return out;
}

function parseForm(body) {
  const o = {};
  for (const part of body.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    o[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1));
  }
  return o;
}

function createFakeTplink({ password, certification = ['SG CLS L1 STAGE2', 'EU CE RED'] }) {
  // Real devices use 1024-bit (password) and 512-bit (signature) keys; OpenSSL refuses to
  // *generate* 512-bit keys, so the fake uses 1024 for both. The client handles any size.
  const pwKey = rsaKey(1024);
  const sigKey = rsaKey(1024);
  const seq = 548894866;
  const oaep = certification.includes('SG CLS L1 STAGE2');
  const sha256 = certification.some((c) => ['SG CLS L1 STAGE2', 'EU CE RED', 'IMDA TS RG-SEC', 'Brazil ANATEL'].includes(c));
  const expectedHash = crypto.createHash(sha256 ? 'sha256' : 'md5').update('admin' + password).digest('hex');
  const stats = { logins: 0, failedLogins: 0, logouts: 0, reads: 0, busy: false };
  const sessions = new Map(); // stok -> { key, iv }
  const startedAt = Date.now();

  const aes = (key, iv) => ({
    enc: (t) => { const c = crypto.createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv)); return Buffer.concat([c.update(t, 'utf8'), c.final()]).toString('base64'); },
    dec: (b) => { const d = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv)); return Buffer.concat([d.update(Buffer.from(b, 'base64')), d.final()]).toString('utf8'); }
  });

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      const m = req.url.match(/^\/cgi-bin\/luci\/;stok=([^/]*)(\/.*)$/);
      if (!m) { res.writeHead(404); return res.end(); }
      const [, stok, path] = m;
      if (path === '/device_config?form=config') return send({ success: true, data: { features: { certification } } });
      if (path === '/login?form=keys') return send({ success: true, data: { password: [pwKey.n, pwKey.e], mode: 'router', username: '' } });
      if (path === '/login?form=auth') return send({ success: true, data: { key: [sigKey.n, sigKey.e], seq } });

      const f = parseForm(body);
      if (path === '/login?form=login') {
        // Signature carries the AES key: decrypt it.
        const sig = decryptHexChunks(f.sign, sigKey, oaep ? crypto.constants.RSA_PKCS1_OAEP_PADDING : crypto.constants.RSA_PKCS1_PADDING, 256);
        const p = Object.fromEntries(sig.split('&').map((x) => x.split('=')));
        if (Number(p.s) !== seq + f.data.length) return send({ success: false, errorcode: 'bad sequence' });
        const a = aes(p.k, p.i);
        const plain = parseForm(a.dec(f.data));
        const pw = pkcs1Decrypt(plain.password, pwKey);
        if (stats.busy && plain.confirm !== 'true') return send({ data: a.enc(JSON.stringify({ success: false, errorcode: 'user conflict' })) });
        if (pw !== password || p.h !== expectedHash) {
          stats.failedLogins++;
          return send({ data: a.enc(JSON.stringify({ success: false, errorcode: 'login failed', data: { failureCount: stats.failedLogins, attemptsAllowed: 10 - stats.failedLogins } })) });
        }
        stats.logins++;
        const token = crypto.randomBytes(8).toString('hex');
        sessions.set(token, { key: p.k, iv: p.i });
        res.setHeader('Set-Cookie', 'sysauth=' + token + '; path=/cgi-bin/luci');
        return send({ data: a.enc(JSON.stringify({ success: true, data: { stok: token } })) });
      }

      const sess = sessions.get(stok);
      if (!sess || !(req.headers.cookie || '').includes('sysauth=' + stok)) { res.writeHead(403); return res.end(); }
      const a = aes(sess.key, sess.iv);
      // Verify HMAC signature with the replaced hash (sha256 of data).
      const h = crypto.createHash('sha256').update(f.data).digest('hex');
      const text = `h=${h}&s=${seq + f.data.length}`;
      let expected = '';
      for (let i = 0; i < text.length; i += 53) expected += crypto.createHmac('sha256', `k=${sess.key}&i=${sess.iv}`).update(text.substring(i, i + 53)).digest('hex');
      if (expected !== f.sign) return send({ data: a.enc(JSON.stringify({ success: false, errorcode: 'bad signature' })) });
      const plain = parseForm(a.dec(f.data));
      stats.reads++;
      const secs = (Date.now() - startedAt) / 1000;
      let reply;
      if (path === '/admin/status?form=all' && plain.operation === 'read') {
        reply = { success: true, data: { cpu_usage: 0.12, mem_usage: 0.43, wan_ipv4_ipaddr: '100.64.1.20', wan_ipv4_uptime: 3600 } };
      } else if (path === '/admin/smart_network?form=game_accelerator' && plain.operation === 'loadDevice') {
        reply = { success: true, data: [
          { deviceName: 'Phone', mac: 'AA-BB-CC-00-00-01', ip: '192.168.0.101', deviceTag: '5G', downloadSpeed: 500000, uploadSpeed: 50000 },
          { deviceName: 'Laptop', mac: 'AA-BB-CC-00-00-02', ip: '192.168.0.102', deviceTag: 'wired', downloadSpeed: 750000 + Math.round(secs), uploadSpeed: 200000 },
          { deviceName: 'Old TV', mac: 'AA-BB-CC-00-00-03', ip: '0.0.0.0', deviceTag: 'offline', downloadSpeed: 0, uploadSpeed: 0 }
        ] };
      } else if (path === '/admin/system?form=logout') {
        stats.logouts++;
        sessions.delete(stok);
        reply = { success: true, data: {} };
      } else {
        reply = { success: false, errorcode: 'not supported' };
      }
      send({ data: a.enc(JSON.stringify(reply)) });
    });
  });
  return { server, stats };
}

module.exports = { createFakeTplink };
