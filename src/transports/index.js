// Entry point for real device connections: one test() per connection method, plus auto-detect.
// Every method is read-only. Results never contain the password or SNMP community.
const { isValidHost, toPort, tcpProbe, ping } = require('./common');
const mikrotik = require('./mikrotik');
const ssh = require('./ssh');
const telnet = require('./telnet');
const snmp = require('./snmp');
const web = require('./http');
const tplink = require('./tplink');
const airos = require('./airos');
const mimosa = require('./mimosa');

const METHODS = {
  ping:       { label: 'Ping only (no login)',            port: null, needsLogin: false },
  mikrotik:   { label: 'MikroTik API',                    port: 8728, needsLogin: true },
  'mikrotik-ssl': { label: 'MikroTik API-SSL',            port: 8729, needsLogin: true },
  ssh:        { label: 'SSH',                             port: 22,   needsLogin: true },
  telnet:     { label: 'Telnet',                          port: 23,   needsLogin: true },
  snmp:       { label: 'SNMP v2c',                        port: 161,  needsLogin: false, community: true },
  snmp1:      { label: 'SNMP v1',                         port: 161,  needsLogin: false, community: true },
  tplink:     { label: 'TP-Link router login',            port: 80,   needsLogin: true, passwordOnly: true },
  airos:      { label: 'Ubiquiti airOS login',            port: 443,  needsLogin: true },
  mimosa:     { label: 'Mimosa login',                    port: 80,   needsLogin: true, passwordOnly: true },
  http:       { label: 'Web UI (HTTP)',                   port: 80,   needsLogin: false },
  https:      { label: 'Web UI (HTTPS)',                  port: 443,  needsLogin: false }
};

// Best method to monitor a device, in order of preference, keyed by vendor.
const METHOD_PREFERENCE = {
  mikrotik: ['mikrotik', 'mikrotik-ssl', 'ssh', 'snmp'],
  cisco: ['ssh', 'snmp', 'telnet'],
  ubnt: ['snmp', 'airos', 'ssh', 'https', 'http'],
  mimosa: ['mimosa', 'snmp', 'https', 'http'],
  tplink: ['tplink', 'snmp', 'http', 'https', 'ssh'],
  onu: ['telnet', 'snmp', 'http', 'https']
};
// Methods where a login or community can actually be verified (so a match means something).
const VERIFIABLE = new Set(['mikrotik', 'mikrotik-ssl', 'ssh', 'telnet', 'snmp', 'snmp1', 'tplink', 'airos', 'mimosa']);

async function test(opts) {
  const method = opts.method || 'ping';
  const def = METHODS[method];
  if (!def) return { ok: false, error: 'Unknown connection method' };
  if (!isValidHost(opts.host)) return { ok: false, error: 'Invalid IP address or host name' };
  const port = toPort(opts.port, def.port);
  const base = { host: opts.host, port, username: opts.username, password: opts.password };
  const started = Date.now();
  let result;
  switch (method) {
    case 'ping': {
      const p = await ping(opts.host);
      result = p.alive
        ? { ok: true, summary: `Replies to ping${p.ms !== null ? ` (${p.ms} ms)` : ''}`, details: { latencyMs: p.ms } }
        : { ok: false, error: p.error || 'No reply to ping (device down, or ICMP blocked)' };
      break;
    }
    case 'mikrotik': result = await mikrotik.test(base); break;
    case 'mikrotik-ssl': result = await mikrotik.test({ ...base, secure: true }); break;
    case 'ssh': result = await ssh.test(base); break;
    case 'telnet': result = await telnet.test(base); break;
    case 'snmp': result = await snmp.test({ host: opts.host, port, community: opts.community, version: '2c' }); break;
    case 'snmp1': result = await snmp.test({ host: opts.host, port, community: opts.community, version: '1' }); break;
    case 'tplink': result = await tplink.test({ host: opts.host, port, password: opts.password }); break;
    case 'airos': result = await airos.test({ host: opts.host, port: opts.port || undefined, username: opts.username, password: opts.password }); break;
    case 'mimosa': result = await mimosa.test({ host: opts.host, port: opts.port || undefined, password: opts.password }); break;
    case 'http':
    case 'https':
      // A TP-Link or Mimosa saved with its password gets the real login; anything else a page check.
      result = opts.type === 'tplink' && opts.password
        ? await tplink.test({ host: opts.host, port, secure: method === 'https', password: opts.password })
        : opts.type === 'mimosa' && opts.password
          ? await mimosa.test({ host: opts.host, port: opts.port || undefined, password: opts.password })
          : await web.test({ ...base, secure: method === 'https' });
      break;
  }
  return { method, port, ms: Date.now() - started, ...result };
}

// Probe common management ports and fingerprint the vendor. Sends no login credentials;
// SNMP uses the read-only community given (default "public").
const DETECT_PORTS = { 22: 'ssh', 23: 'telnet', 80: 'http', 443: 'https', 8291: 'winbox', 8728: 'mikrotik', 8729: 'mikrotik-ssl' };

async function detect(host, { community } = {}) {
  if (!isValidHost(host)) return { ok: false, error: 'Invalid IP address or host name' };
  const tcpPorts = DETECT_PORTS;
  const [pingRes, snmpRes, ...portRes] = await Promise.all([
    ping(host),
    snmp.test({ host, community: community || 'public', timeout: 2500 }),
    ...Object.keys(tcpPorts).map((p) => tcpProbe(host, Number(p), { timeout: 2500, readBanner: p === '22' || p === '23' }))
  ]);
  const open = {};
  Object.keys(tcpPorts).forEach((p, i) => { if (portRes[i].open) open[tcpPorts[p]] = { port: Number(p), banner: portRes[i].banner || undefined }; });

  const votes = [];
  if (open.winbox || open.mikrotik || open['mikrotik-ssl']) votes.push('mikrotik');
  if (snmpRes.ok) votes.push(snmp.vendorFromObjectId(snmpRes.details.objectId));
  if (open.ssh && open.ssh.banner) votes.push(ssh.vendorFromIdent(open.ssh.banner));
  if (snmpRes.ok) votes.push(web.guessVendor(String(snmpRes.details.description || '') + ' ' + String(snmpRes.details.name || '')));
  let webInfo = null;
  if (open.http || open.https) {
    webInfo = await web.test({ host, secure: !open.http, port: open.http ? 80 : 443, timeout: 4000 });
    if (webInfo.vendor) votes.push(webInfo.vendor);
    // A plain HTTP root often 404s on radios (airOS, etc.); the HTTPS login page usually identifies it.
    if (!webInfo.vendor && open.https && open.http) {
      const sec = await web.test({ host, secure: true, port: 443, timeout: 4000 });
      if (sec.vendor) { votes.push(sec.vendor); if (!webInfo.details || !webInfo.details.model) webInfo = sec; }
    }
  }
  if (open.telnet && open.telnet.banner) votes.push(web.guessVendor(open.telnet.banner));
  const vendor = votes.find(Boolean) || null;

  // Best method to monitor this device, in order of preference.
  const preference = METHOD_PREFERENCE[vendor] || ['ssh', 'snmp', 'mikrotik', 'telnet', 'http', 'https'];
  // The TP-Link login only applies to the newer /webpages/ firmware (model detected from it).
  const available = (m) => (m === 'snmp' ? snmpRes.ok : m === 'tplink' ? !!(open.http && webInfo && webInfo.details && webInfo.details.model) : (m === 'airos' || m === 'mimosa') ? !!(open.http || open.https) : !!open[m]);
  const suggestedMethod = preference.find(available) || (pingRes.alive ? 'ping' : null);

  return {
    ok: pingRes.alive || Object.keys(open).length > 0 || snmpRes.ok,
    host,
    vendor,
    suggestedMethod,
    ping: pingRes,
    openPorts: open,
    snmp: snmpRes.ok ? snmpRes.details : null,
    web: webInfo && webInfo.ok ? { title: webInfo.details.title, server: webInfo.details.server, model: webInfo.details.model, firmware: webInfo.details.firmware } : null
  };
}

// Try the saved vault logins / SNMP communities against a device and return the first that
// actually verifies, with the method it worked on. Used when adding a device so the owner does
// not have to pick a method or type a password per device. Tries the detected/chosen method
// first, then the vendor's fallback methods (so a MikroTik with the API off falls back to SSH,
// and so on). Only verifiable methods are tried — a plain web page can't confirm a login.
// Attempts are bounded by the vault size, so it won't spray a device with endless guesses.
async function probeCredentials({ host, method, port, vendor, logins = [], communities = [], perTry = 6000 }) {
  if (!isValidHost(host)) return { ok: false };
  // When the vendor is unknown, still try the common authenticated methods so "Fix unconnected"
  // can reach a device we couldn't fingerprint.
  const ordered = [method, ...(METHOD_PREFERENCE[vendor] || ['snmp', 'ssh', 'mikrotik', 'telnet', 'airos'])]
    .filter((m, i, a) => m && VERIFIABLE.has(m) && a.indexOf(m) === i);
  for (const m of ordered) {
    const def = METHODS[m];
    if (!def) continue;
    const onDetected = m === method;
    const attempts = [];
    if (m === 'snmp' || m === 'snmp1') {
      communities.forEach((c) => attempts.push({ community: c.community, _label: c.label, _communityId: c.id }));
    } else if (def.passwordOnly) {
      logins.forEach((l) => attempts.push({ password: l.password, _label: l.label, _credentialId: l.id }));
    } else {
      logins.forEach((l) => attempts.push({ username: l.username, password: l.password, _label: l.label, _credentialId: l.id }));
    }
    for (const a of attempts) {
      const r = await test({ host, method: m, type: vendor, port: onDetected ? port : undefined, timeout: perTry, username: a.username, password: a.password, community: a.community });
      if (r.ok) {
        return { ok: true, method: m, port: r.port, username: a.username, password: a.password, community: a.community, label: a._label, credentialId: a._credentialId, communityId: a._communityId, test: r };
      }
    }
  }
  return { ok: false };
}

// Cheap reachability check used by background monitoring (never sends credentials).
async function reachable(device) {
  const def = METHODS[device.method] || METHODS.ping;
  const port = toPort(device.port, def.port);
  if (!port || device.method === 'snmp' || device.method === 'snmp1') {
    const p = await ping(device.ip);
    return { online: p.alive, latencyMs: p.ms };
  }
  const t = await tcpProbe(device.ip, port, { timeout: 3000 });
  return { online: t.open, latencyMs: t.ms };
}

module.exports = { METHODS, DETECT_PORTS, METHOD_PREFERENCE, test, detect, probeCredentials, reachable };
