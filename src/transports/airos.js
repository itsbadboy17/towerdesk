// Ubiquiti airOS (airMAX) login + status reader. airMAX radios (NanoStation, PowerBeam, Rocket,
// LiteBeam, airFiber-ish) serve their real data from /status.cgi only after a web login at
// /login.cgi, which is why a plain web check only saw the "404" root page. This logs in with the
// saved credentials and reads /status.cgi (hostname, model, firmware, signal, CPU/RAM, and the
// interface byte counters used for traffic graphs). Read-only: it never changes the radio.
const http = require('http');
const https = require('https');
const { friendlyError, tcpProbe } = require('./common');

class AirosError extends Error {
  constructor(kind, message) { super(message); this.name = 'AirosError'; this.kind = kind; }
}

function request(method, urlStr, { headers = {}, body = null, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method, headers, rejectUnauthorized: false, timeout }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { if (size < 1048576) { chunks.push(c); size += c.length; } });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function addCookies(jar, res) {
  const sc = res.headers['set-cookie'];
  if (sc) sc.forEach((c) => { const m = c.match(/^\s*([^=;]+)=([^;]*)/); if (m) jar[m[1].trim()] = m[2]; });
}
function cookieHeader(jar) { return Object.keys(jar).map((k) => k + '=' + jar[k]).join('; '); }

function multipart(fields) {
  const b = '----towerdeskairos' + Math.random().toString(16).slice(2);
  let s = '';
  for (const k of Object.keys(fields)) s += `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${fields[k]}\r\n`;
  s += `--${b}--\r\n`;
  return { body: Buffer.from(s), type: 'multipart/form-data; boundary=' + b };
}

function num(v) { return v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined; }

// Turn airOS status.cgi JSON into the shape the rest of TowerDesk expects.
function parseStatus(j) {
  const h = j.host || {};
  const w = j.wireless || {};
  const interfaces = (j.interfaces || []).map((i) => {
    const st = i.status || i.stats || {};
    return {
      name: i.ifname,
      up: st.plugged === 1 || st.plugged === true || i.enabled === true || i.enabled === 1,
      rxBytes: num(st.rx_bytes),
      txBytes: num(st.tx_bytes),
      counterBits: 64
    };
  }).filter((i) => i.name && i.rxBytes !== undefined && i.txBytes !== undefined);
  const total = num(h.totalram);
  const free = num(h.freeram);
  const signal = num(w.signal);
  const noise = num(w.noisef) !== undefined ? num(w.noisef) : num(w.noise);
  let ccq = num(w.ccq);
  if (ccq !== undefined && ccq > 100) ccq = Math.round(ccq / 10); // airOS reports CCQ per-mille (0–1000)
  const snr = num(w.snr) !== undefined ? num(w.snr) : (signal !== undefined && noise !== undefined ? signal - noise : undefined);
  const freqRaw = w.frequency !== undefined ? w.frequency : w.freq;
  // Connected subscriber radios (only populated on a point-to-multipoint AP). Each remote CPE
  // reports its own signal, link quality, IP and byte counters (used for live per-user throughput).
  const stations = (Array.isArray(w.sta) ? w.sta : []).map((x) => {
    const rem = x.remote || {};
    const st = x.stats || {};
    return {
      name: rem.hostname || x.name || rem.name || x.lastip || x.mac,
      ip: x.lastip || rem.ip,
      mac: x.mac,
      signal: num(x.signal),
      ccq: (x.airmax && num(x.airmax.quality) !== undefined) ? num(x.airmax.quality) : num(x.ccq),
      txRate: num(x.tx),
      rxRate: num(x.rx),
      platform: rem.platform,
      uptime: num(x.uptime),
      rxBytes: num(st.rx_bytes),
      txBytes: num(st.tx_bytes)
    };
  }).filter((x) => x.mac || x.ip);
  const radio = {
    essid: w.essid,
    mode: w.mode,
    signal, noise, snr, ccq,
    txRate: num(w.txrate),
    rxRate: num(w.rxrate),
    freq: freqRaw === undefined ? undefined : (/mhz/i.test(String(freqRaw)) ? String(freqRaw) : (num(freqRaw) !== undefined ? num(freqRaw) + ' MHz' : String(freqRaw))),
    chanbw: num(w.chanbw) !== undefined ? num(w.chanbw) : num(w.chwidth),
    txpower: num(w.txpower),
    stations: stations.length || undefined,
    temp: num(h.temperature)
  };
  return {
    hostname: h.hostname,
    model: h.devmodel || h.platform,
    firmware: h.fwversion,
    uptime: num(h.uptime),
    cpu: num(h.cpuload),
    memPct: total ? Math.round(((total - (free || 0)) / total) * 100) : undefined,
    signal,
    ccq,
    essid: w.essid,
    mode: w.mode,
    radio,
    stations,
    interfaces
  };
}

function formatSecs(n) {
  if (!Number.isFinite(n)) return undefined;
  const d = Math.floor(n / 86400), h = Math.floor((n % 86400) / 3600), m = Math.floor((n % 3600) / 60);
  return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
}

// A logged-in airOS session that can be polled repeatedly (one login, reused between polls).
class AirosSession {
  constructor({ base, jar, timeout, port, secure }) { this.base = base; this.jar = jar; this.timeout = timeout; this.port = port; this.secure = secure; this.closed = false; }

  static async open({ host, port, secure = true, username = 'ubnt', password = '', timeout = 8000 }) {
    const scheme = secure ? 'https' : 'http';
    port = port || (secure ? 443 : 80);
    const base = `${scheme}://${host}:${port}`;
    const jar = {};
    let g;
    try { g = await request('GET', base + '/login.cgi', { timeout }); }
    catch (e) { throw new AirosError('network', friendlyError(e)); }
    addCookies(jar, g); // seed the AIROS_SESSIONID cookie the radio expects back on login
    const mp = multipart({ uri: '/', username, password });
    try {
      const p = await request('POST', base + '/login.cgi', {
        headers: { 'Content-Type': mp.type, 'Content-Length': mp.body.length, Cookie: cookieHeader(jar), Referer: base + '/login.cgi' },
        body: mp.body, timeout
      });
      addCookies(jar, p);
    } catch (e) { throw new AirosError('network', friendlyError(e)); }
    const session = new AirosSession({ base, jar, timeout, port, secure });
    const j = await session.fetchStatus();
    if (!j) throw new AirosError('auth', 'Wrong username or password');
    session._status = j;
    return session;
  }

  async fetchStatus() {
    let r;
    try { r = await request('GET', this.base + '/status.cgi', { headers: { Cookie: cookieHeader(this.jar) }, timeout: this.timeout }); }
    catch (e) { throw new AirosError('network', friendlyError(e)); }
    addCookies(this.jar, r);
    if (r.status === 200 && /^\s*\{/.test(r.body)) {
      try { return JSON.parse(r.body); } catch (e) { throw new AirosError('protocol', 'airOS status could not be read'); }
    }
    return null; // redirected back to the login page => not authenticated / session gone
  }

  async readStats() {
    const j = await this.fetchStatus();
    if (!j) throw new AirosError('expired', 'airOS session expired');
    return parseStatus(j);
  }

  async logout() {
    this.closed = true;
    try { await request('GET', this.base + '/logout.cgi', { headers: { Cookie: cookieHeader(this.jar) }, timeout: this.timeout }); } catch (e) { /* best effort */ }
  }
  close() { this.closed = true; }

  // Log in without caring whether the radio speaks HTTPS or plain HTTP. Newer airOS forces HTTPS;
  // older units (and some CPEs) only serve HTTP on port 80. A wrong password is not retried on the
  // other scheme; only a connection failure is.
  static async connect(opts) {
    let order;
    if (opts.port === 80) order = [false];
    else if (opts.port === 443) order = [true];
    else {
      // Probe which web port actually answers first, so we never wait on a filtered 443.
      const [https443, http80] = await Promise.all([
        tcpProbe(opts.host, 443, { timeout: 2500 }),
        tcpProbe(opts.host, 80, { timeout: 2500 })
      ]);
      order = [];
      if (https443.open) order.push(true);
      if (http80.open) order.push(false);
      if (!order.length) order = [true, false];
    }
    let lastErr;
    for (const secure of order) {
      try { return await AirosSession.open({ ...opts, secure, port: opts.port || (secure ? 443 : 80) }); }
      catch (e) { lastErr = e; if (e.kind === 'auth') throw e; }
    }
    throw lastErr;
  }
}

async function test(opts) {
  let session;
  try {
    session = await AirosSession.connect(opts);
    const st = parseStatus(session._status);
    return {
      ok: true,
      vendor: 'ubnt',
      port: session.port, // the scheme/port that actually worked (80 for HTTP-only radios)
      summary: (st.hostname || 'airOS') + (st.model ? ' — ' + st.model : '') + (st.signal !== undefined ? ' · ' + st.signal + ' dBm' : ''),
      details: {
        name: st.hostname, model: st.model, firmware: st.firmware,
        signal: st.signal !== undefined ? st.signal + ' dBm' : undefined,
        ccq: st.ccq !== undefined ? st.ccq + '%' : undefined,
        uptime: st.uptime ? formatSecs(st.uptime) : undefined
      }
    };
  } catch (e) {
    return { ok: false, error: e.kind === 'auth' ? 'Wrong username or password' : (e.message || 'airOS login failed'), errorKind: e.kind };
  } finally {
    if (session) await session.logout();
  }
}

module.exports = { AirosSession, AirosError, test, parseStatus, formatSecs };
