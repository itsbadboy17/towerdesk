// HTTP/HTTPS web-interface check. Reads the login page (title, server header) to confirm the
// device answers and to guess the vendor. If the device uses HTTP Basic auth and credentials are
// given, it verifies them. Form-based web logins differ per vendor/model and are not automated:
// TODO(real-connector): add per-model web login only when the exact firmware API is known.
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { DEFAULT_TIMEOUT, friendlyError } = require('./common');

function get(urlStr, { headers = {}, timeout }) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'GET',
      headers: { 'User-Agent': 'TowerDesk/0.1', Accept: 'text/html,*/*', ...headers },
      rejectUnauthorized: false, // devices commonly use self-signed certificates
      timeout
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { if (size < 262144) { chunks.push(c); size += c.length; } });
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        // Some devices gzip pages even when not asked to.
        const enc = String(res.headers['content-encoding'] || '');
        try {
          if (/gzip/i.test(enc) || (raw[0] === 0x1f && raw[1] === 0x8b)) raw = zlib.gunzipSync(raw);
          else if (/deflate/i.test(enc)) raw = zlib.inflateSync(raw);
        } catch (e) { /* leave as-is if it is not really compressed */ }
        resolve({ status: res.statusCode, headers: res.headers, body: raw.toString('latin1').slice(0, 65536) });
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end();
  });
}

function guessVendor(text) {
  const t = text.toLowerCase();
  if (/routeros|mikrotik|webfig/.test(t)) return 'mikrotik';
  if (/tp-?link|archer|tl-wr|deco|omada/.test(t)) return 'tplink';
  if (/airos|ubiquiti|ubnt|edgeos|unifi/.test(t)) return 'ubnt';
  if (/mimosa/.test(t)) return 'mimosa';
  if (/cisco/.test(t)) return 'cisco';
  if (/gpon|epon|xpon|\bonu\b|\bont\b|echolife|hg8\d|zxhn|f6\d\d|huawei|zte|fiberhome|optilink|v-sol|vsol/.test(t)) return 'onu';
  return null;
}

async function test({ host, port, secure, username, password, timeout = DEFAULT_TIMEOUT }) {
  const scheme = secure ? 'https' : 'http';
  port = port || (secure ? 443 : 80);
  let url = `${scheme}://${host}:${port}/`;
  try {
    let res = await get(url, { timeout });
    // Follow up to three redirects on the same device (HTTP Location or <meta http-equiv="refresh">).
    for (let i = 0; i < 3; i++) {
      let next = null;
      if (res.status >= 300 && res.status < 400 && res.headers.location) next = res.headers.location;
      else {
        const meta = res.body.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/i);
        if (meta) next = meta[1];
      }
      if (!next) break;
      const target = new URL(next, url);
      if (target.hostname !== new URL(url).hostname) break; // stay on the device
      url = target.toString();
      res = await get(url, { timeout });
    }
    const title = ((res.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const server = res.headers.server || '';
    const realm = res.headers['www-authenticate'] || '';
    // Newer TP-Link firmware serves a JS app from /webpages/ with <meta name="version" content="AX12v1_1.10.2_...">.
    const fw = (res.body.match(/<meta[^>]+name=["']version["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
    const fwModel = fw.match(/^([A-Za-z]+[\w-]*?\d+[A-Za-z]*)v(\d+)_([\d.]+)/);
    let vendor = guessVendor([title, server, realm, res.body.slice(0, 8000)].join(' '));
    if (!vendor && fwModel && /\/webpages\//.test(url)) vendor = 'tplink';
    // Ubiquiti airOS: its login sets an AIROS_SESSIONID cookie and the web root redirects to /login.cgi.
    if (!vendor && (/AIROS_SESSIONID/i.test(String(res.headers['set-cookie'] || '')) || /login\.cgi/i.test(url))) vendor = 'ubnt';
    const details = {
      status: res.status,
      title: title && !/^opening/i.test(title) ? title : undefined,
      server: server || undefined,
      model: fwModel ? `${fwModel[1]} v${fwModel[2]}` : undefined,
      firmware: fwModel ? fwModel[3] : undefined
    };

    if (res.status === 401 && /basic/i.test(realm)) {
      if (!username) return { ok: true, vendor, summary: 'Web UI asks for a login (HTTP Basic)', details };
      const auth = 'Basic ' + Buffer.from(`${username}:${password || ''}`).toString('base64');
      const res2 = await get(url, { timeout, headers: { Authorization: auth } });
      if (res2.status === 401 || res2.status === 403) return { ok: false, error: 'Wrong username or password', details };
      return { ok: true, vendor, summary: 'Web UI login OK (HTTP Basic)', details: { ...details, status: res2.status } };
    }
    return {
      ok: res.status < 500,
      vendor,
      summary: `Web UI reachable${details.model ? ': ' + (vendor === 'tplink' ? 'TP-Link ' : '') + details.model : (details.title ? ': ' + details.title : '')}`,
      details,
      note: username ? 'This web UI uses a form login, which differs per model; credentials were saved but not verified over HTTP.' : undefined
    };
  } catch (err) {
    return { ok: false, error: friendlyError(err) };
  }
}

module.exports = { test, guessVendor };
