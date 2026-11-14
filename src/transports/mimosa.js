// Mimosa (by Airspan) B5c/C5c login + dashboard reader. Mimosa PtP radios serve their data from
// /cgi/dashboard.php after a PASSWORD-ONLY web login at /login.php (no username). Most units run the
// UI over plain HTTP (port 80); HTTPS is often disabled/broken, so we prefer HTTP. Read-only: it
// logs in and reads the dashboard JSON (signal, noise, PHY rate, throughput, link name, distance,
// availability, temperature, and the remote end of the link). It never changes the radio.
const http = require('http');
const https = require('https');
const { friendlyError, tcpProbe } = require('./common');

class MimosaError extends Error {
  constructor(kind, message) { super(message); this.name = 'MimosaError'; this.kind = kind; }
}

function request(method, urlStr, { headers = {}, body = null, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method, headers, rejectUnauthorized: false, timeout }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { if (size < 2097152) { chunks.push(c); size += c.length; } });
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

function nf(v) {
  if (v === undefined || v === null) return undefined;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
function chainVals(v) {
  return String(v == null ? '' : v).split(/[\s,/]+/).map((x) => parseFloat(x)).filter(Number.isFinite);
}

// Turn the dashboard JSON into TowerDesk's shape. The live radio stats are packed into
// signalmeter.get_phy as a URL-query string (rssi_average, tx_phy_rate, noise, …), and the
// throughput is a "timestamp:bytesPerSecond,…" series.
function parseStatus(j) {
  const rt = (j && j.realtime) || j || {};
  const di = rt.device_info || {};
  const s = rt.signalmeter || {};
  const c = rt.connection || {};
  const rem = rt.remote_info || {};
  const q = new URLSearchParams(String(s.get_phy || ''));
  const qn = (k) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : undefined; };
  const signal = qn('rssi_average');
  const noise = qn('noise') !== undefined ? qn('noise') : nf(s.noise);
  const snr = (signal !== undefined && noise !== undefined) ? Math.round((signal - noise) * 10) / 10 : undefined;
  // Throughput is a "timestamp:bytesPerSecond,…" series; take the most recent valid sample -> Mbps.
  let throughput;
  const tser = rt.throughput && typeof rt.throughput === 'object' ? rt.throughput.throughput : rt.throughput;
  if (tser) {
    const samples = String(tser).split(',').map((p) => parseFloat(p.split(':').pop())).filter((n) => Number.isFinite(n));
    if (samples.length) throughput = Math.round((samples[samples.length - 1] * 8) / 1e6 * 10) / 10;
  }
  const bwM = String(s.BandWidth || '').match(/(\d+)\s*$/); // "1x80" -> 80
  const distM = nf(c.distance);
  const distance = distM === undefined ? undefined : (distM > 50 ? Math.round((distM / 1000) * 100) / 100 : distM);
  const txpower = nf(s.ActualTotalTxPower) !== undefined ? nf(s.ActualTotalTxPower) : nf(s.tx_power);
  const MODELS = { C02: 'C5c' }; // confirmed; other codes fall through to the raw value
  // Which end of the link this radio is. A point-to-point "Access point" is the master end ('master',
  // never 'ap', which TowerDesk reads as a sector); a point-to-multipoint one is a real AP.
  const devMode = String(di.DeviceMode || '');
  const mode = /access/i.test(devMode) ? (String(di.PTMPMode) === '1' ? 'ap-ptmp' : 'master') : (/station/i.test(devMode) ? 'sta' : undefined);
  return {
    hostname: di.DeviceName,
    model: di.productName || MODELS[di.Model] || di.Model,
    firmware: di.Version,
    serial: di.SerialNumber,
    temp: nf(di.Temperature),
    radio: {
      signal, noise, snr,
      txRate: qn('tx_phy_rate'),
      rxRate: qn('rx_phy_rate'),
      freq: s.Chains_1_2 ? String(s.Chains_1_2) : undefined,
      chanbw: bwM ? Number(bwM[1]) : undefined,
      txpower,
      temp: nf(di.Temperature),
      linkName: c.linkName || c.SSID,
      distance,
      availability: nf(c.availability),
      connected: String(c.connected) === '1' || c.connected === true,
      throughput,
      remoteName: rem.DeviceName,
      remoteModel: rem.Model,
      mode,
      remoteMode: /station/i.test(String(rem.DeviceMode || '')) ? 'sta' : (/access/i.test(String(rem.DeviceMode || '')) ? 'master' : undefined)
    },
    throughput
  };
}

class MimosaSession {
  constructor({ base, jar, timeout, port, secure }) { this.base = base; this.jar = jar; this.timeout = timeout; this.port = port; this.secure = secure; this.closed = false; }

  static async open({ host, port, secure = false, password = '', timeout = 8000 }) {
    const scheme = secure ? 'https' : 'http';
    port = port || (secure ? 443 : 80);
    const base = `${scheme}://${host}:${port}`;
    const jar = {};
    try { const g = await request('GET', base + '/', { timeout }); addCookies(jar, g); } catch (e) { throw new MimosaError('network', friendlyError(e)); }
    // Mimosa's web login uses a fixed account name "configure" (a hidden field); the visible form
    // only asks for the password. Sending an empty username makes the device answer 401.
    const form = 'username=configure&password=' + encodeURIComponent(password || '');
    let loginStatus = 0;
    try {
      const p = await request('POST', base + '/login.php', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form), Cookie: cookieHeader(jar), Referer: base + '/', 'X-Requested-With': 'XMLHttpRequest' },
        body: form, timeout
      });
      addCookies(jar, p);
      loginStatus = p.status;
    } catch (e) { throw new MimosaError('network', friendlyError(e)); }
    // The device answers 401/403 for a wrong password and 200 for a correct one.
    if (loginStatus === 401 || loginStatus === 403) throw new MimosaError('auth', 'Wrong password');
    const session = new MimosaSession({ base, jar, timeout, port, secure });
    // A 200 login is enough (the dashboard can be momentarily 503 right after login); otherwise
    // require a readable dashboard before declaring success.
    const data = await session.fetchDashboard().catch(() => null);
    if (loginStatus !== 200 && !data) throw new MimosaError('auth', 'Wrong password');
    session._data = data;
    return session;
  }

  // Try HTTP then HTTPS (or whichever port is open); a wrong password is not retried on the other.
  static async connect(opts) {
    let order;
    if (opts.port === 80) order = [false];
    else if (opts.port === 443) order = [true];
    else {
      const [p80, p443] = await Promise.all([
        tcpProbe(opts.host, 80, { timeout: 2500 }),
        tcpProbe(opts.host, 443, { timeout: 2500 })
      ]);
      order = [];
      if (p80.open) order.push(false);
      if (p443.open) order.push(true);
      if (!order.length) order = [false, true];
    }
    let lastErr;
    for (const secure of order) {
      try { return await MimosaSession.open({ ...opts, secure, port: opts.port || (secure ? 443 : 80) }); }
      catch (e) { lastErr = e; if (e.kind === 'auth') throw e; }
    }
    throw lastErr;
  }

  async fetchDashboard() {
    let r;
    try { r = await request('GET', this.base + '/cgi/dashboard.php', { headers: { Cookie: cookieHeader(this.jar) }, timeout: this.timeout }); }
    catch (e) { throw new MimosaError('network', friendlyError(e)); }
    addCookies(this.jar, r);
    if (r.status === 200 && /realtime/.test(r.body) && /^[\s[{]*\{/.test(r.body)) {
      try { return JSON.parse(r.body); } catch (e) { throw new MimosaError('protocol', 'Mimosa dashboard could not be read'); }
    }
    return null; // login page / redirect => not authenticated
  }

  async readStats() {
    const j = await this.fetchDashboard();
    if (!j) throw new MimosaError('expired', 'Mimosa session expired');
    return parseStatus(j);
  }

  async logout() {
    this.closed = true;
    try { await request('GET', this.base + '/logout.php', { headers: { Cookie: cookieHeader(this.jar) }, timeout: this.timeout }); } catch (e) { /* best effort */ }
  }
  close() { this.closed = true; }
}

async function test(opts) {
  let session;
  try {
    session = await MimosaSession.connect(opts);
    const st = parseStatus(session._data);
    return {
      ok: true,
      vendor: 'mimosa',
      port: session.port,
      summary: (st.hostname || 'Mimosa') + (st.model ? ' — ' + st.model : '') + (st.radio.signal !== undefined ? ' · ' + st.radio.signal + ' dBm' : ''),
      details: {
        name: st.hostname, model: st.model, firmware: st.firmware,
        signal: st.radio.signal !== undefined ? st.radio.signal + ' dBm' : undefined,
        link: st.radio.linkName,
        remote: st.radio.remoteName
      }
    };
  } catch (e) {
    return { ok: false, error: e.kind === 'auth' ? 'Wrong password' : (e.message || 'Mimosa login failed'), errorKind: e.kind };
  } finally {
    if (session) await session.logout();
  }
}

module.exports = { MimosaSession, MimosaError, test, parseStatus };
