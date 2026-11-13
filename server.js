const express = require('express');
const path = require('path');
const auth = require('./src/auth');
const app = express();

app.disable('x-powered-by');
// Small JSON bodies everywhere; the restore upload brings its own larger limit.
const jsonBody = express.json();
app.use((req, res, next) => (req.path === '/api/restore' ? next() : jsonBody(req, res, next)));

// Login (enforced once a password is set with `npm run set-password`)
app.get('/login', (req, res) => {
  if (auth.getSession(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/api/login', auth.login);
app.post('/api/logout', auth.logout);
app.get('/api/session', (req, res) => {
  const s = auth.getSession(req);
  res.json({ authRequired: auth.isConfigured() && process.env.TOWERDESK_AUTH !== 'off', user: s ? s.user : null });
});
app.use(auth.middleware);

// Static folder for views and assets
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Overview page (the dashboard)
// The Overview page still shows sample data, so the app opens on the live Monitoring page.
// The sample Overview stays reachable at /dashboard.
app.get('/', (req, res) => {
  res.redirect('/monitoring');
});

// Routes for different pages (placeholder)
app.get('/subscribers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscribers.html'));
});

app.get('/sas', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'subscribers.html'));
});

app.get('/plans', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'plans.html'));
});

app.get('/monitoring', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'monitoring.html'));
});

app.get('/alerts', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'alerts.html'));
});

app.get('/remote', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'remote.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// API route to get mock data
app.get('/api/mock-data', (req, res) => {
  try {
    const mockData = require('./public/mock-data');
    res.json(mockData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load mock data' });
  }
});

// API route to get mock connector status
app.get('/api/mock-connector/:deviceType', (req, res) => {
  try {
    const { mockConnectors } = require('./public/mock-connector');
    const deviceType = req.params.deviceType;
    
    if (!mockConnectors[deviceType]) {
      return res.status(404).json({ error: 'Device type not found' });
    }
    
    // Simulate getting status for a device
    const mockDevice = {
      ip: '192.168.1.1',
      status: 'online',
      clients: 25,
      memory: '85%',
      cpu: '45%'
    };
    
    res.json({
      deviceType: deviceType,
      status: mockDevice.status,
      clients: mockDevice.clients,
      memory: mockDevice.memory,
      cpu: mockDevice.cpu
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get connector status' });
  }
});

// API route to get tower list
app.get('/api/notifications', (req, res) => { res.json([ { id: 'ntf-1', type: 'alert', message: 'High CPU on node-001', severity: 'warning', time: '2026-11-01T10:00:00Z' }, ]); });

app.get('/api/invoices', (req, res) => { res.json([ { id: 'inv-001', subscriber: 'sub-001', amount: 50, status: 'paid' } ]); });

app.get('/api/towers', (req, res) => {
  try {
    const mockData = require('./public/mock-data');
    res.json(mockData.towers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load towers data' });
  }
});

app.get('/api/bandwidth', (req, res) => {
  res.json({
    series: [
      { t: '2026-10-30T10:00:00Z', down: 12.5, up: 8.2 },
      { t: '2026-10-30T10:05:00Z', down: 13.0, up: 8.5 },
      { t: '2026-10-30T10:10:00Z', down: 12.8, up: 8.3 },
      { t: '2026-10-30T10:15:00Z', down: 13.2, up: 8.7 },
      { t: '2026-10-30T10:20:00Z', down: 13.5, up: 9.0 }
    ]
  });
});

// API route to get subscriber list
app.get('/api/subscribers', (req, res) => {
  try {
    const mockData = require('./public/mock-data');
    res.json(mockData.subscribers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load subscribers data' });
  }
});

// API route to get plans list
app.get('/api/plans', (req, res) => {
  try {
    const mockData = require('./public/mock-data');
    res.json(mockData.plans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load plans data' });
  }
});

// API route to get vouchers list
app.get('/api/vouchers', (req, res) => {
  try {
    const mockData = require('./public/mock-data');
    res.json(mockData.vouchers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load vouchers data' });
  }
});

app.get('/api/reports/subscribers', (req, res) => {
  const mockData = require('./public/mock-data');
  const header = 'id,name,email,plan,balance,status';
  const rows = mockData.subscribers.map(function (s) {
    return [
      s.id,
      s.name,
      s.email,
      s.plan,
      s.balance,
      s.status
    ].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
  });
  res.setHeader('Content-Type', 'text/csv');
  res.status(200).send(header + '\n' + rows.join('\n'));
});

app.get('/vouchers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'vouchers.html'));
});

app.get('/tickets', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tickets.html'));
});

app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'map.html'));
});
app.get('/billing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'billing.html'));
});

app.get('/invoices', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'invoices.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/add-device', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-device.html'));
});

app.post('/api/actions', (req, res) => {
  const { action, deviceType } = req.body || {};
  const { mockConnectors } = require('./public/mock-connector');
  const connector = mockConnectors[deviceType || 'mikrotik'];
  if (!connector || typeof connector.runAction !== 'function') {
    return res.status(404).json({ error: 'Unknown action' });
  }
  return connector.runAction(action || 'noop').then(function (r) { res.json(r); });
});

// ----- Real devices (read-only connections; secrets never returned) -----
const transports = require('./src/transports');
const devices = require('./src/devices');
const credentials = require('./src/credentials');

// ----- Credential vault: the few logins / SNMP communities tried automatically on add -----
app.get('/api/credentials', (req, res) => res.json(credentials.list()));
app.post('/api/credentials', (req, res) => {
  const b = req.body || {};
  if (b.kind === 'community') {
    if (!b.community) return res.status(400).json({ error: 'Enter the SNMP community' });
    return res.json({ success: true, item: credentials.addCommunity(b), kind: 'community' });
  }
  if (!b.password) return res.status(400).json({ error: 'Enter the password' });
  res.json({ success: true, item: credentials.addLogin(b), kind: 'login' });
});
app.delete('/api/credentials/:id', (req, res) => {
  if (!credentials.remove(req.params.id)) return res.status(404).json({ error: 'Credential not found' });
  res.json({ success: true });
});

function connectionInput(body) {
  return {
    host: String(body.ip || '').trim(),
    type: body.type,
    method: body.method || 'ping',
    port: body.port,
    username: body.username,
    password: body.password,
    community: body.community
  };
}

// Give a device the real hostname/model a successful login reported, but only when its current
// name is a placeholder (a scan's "404" page title, a bare vendor word, or the IP). A name the
// user actually chose is never overwritten.
function realNameFrom(test) {
  const d = (test && test.details) || {};
  return d.name || d.identity || d.model || null;
}
function isPlaceholderName(name, ip) {
  const n = String(name || '').trim().toLowerCase();
  if (!n || n === String(ip).toLowerCase()) return true;
  if (/^device\s/.test(n)) return true;
  if (/\b[45]\d\d\b|not\s*found|page\s*not|unauthoriz|forbidden|^error|bad\s*request/.test(n)) return true;
  return ['ubiquiti', 'mimosa', 'mikrotik', 'cisco', 'other', 'airos', 'unknown'].includes(n);
}
function applyAutoName(id, test) {
  if (!test || !test.ok) return;
  const real = realNameFrom(test);
  if (!real) return;
  const cur = devices.get(id);
  if (cur && isPlaceholderName(cur.name, cur.ip)) devices.edit(id, { name: String(real).slice(0, 80) });
}

app.get('/api/devices/methods', (req, res) => res.json(transports.METHODS));

app.post('/api/devices/detect', async (req, res) => {
  const body = req.body || {};
  const ip = String(body.ip || '').trim();
  if (!ip) return res.status(400).json({ error: 'IP address is required' });
  const result = await transports.detect(ip);
  // Optionally try the saved logins / communities and report which method they verified on.
  if (body.tryVault && result.ok) {
    const vault = credentials.resolved();
    if (vault.logins.length || vault.communities.length) {
      const probe = await transports.probeCredentials({ host: ip, method: result.suggestedMethod, vendor: result.vendor, logins: vault.logins, communities: vault.communities });
      if (probe.ok) result.matched = { method: probe.method, label: probe.label }; // never the secret
    }
  }
  res.json(result);
});

app.post('/api/devices/test', async (req, res) => {
  const input = connectionInput(req.body || {});
  if (!input.host) return res.status(400).json({ error: 'IP address is required' });
  res.json(await transports.test(input));
});

app.get('/api/devices', (req, res) => res.json(devices.list()));

app.post('/api/devices', async (req, res) => {
  const body = req.body || {};
  const { name, type, ip } = body;
  if (!name || !type || !ip) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (body.method && !transports.METHODS[body.method]) {
    return res.status(400).json({ error: 'Unknown connection method' });
  }
  // Auto-try the saved vault credentials when asked and the user didn't type a password/community.
  // A match sets the device's method and copies the working login in (encrypted) so monitoring
  // just works; the matched label is reported, never the secret.
  let saveBody = body;
  let matched = null;
  if (body.tryVault && !body.password && !body.community) {
    const vault = credentials.resolved();
    if (vault.logins.length || vault.communities.length) {
      const probe = await transports.probeCredentials({ host: body.ip.trim(), method: body.method, port: body.port, vendor: body.type, logins: vault.logins, communities: vault.communities });
      if (probe.ok) {
        saveBody = { ...body, method: probe.method, port: probe.port, username: probe.username, password: probe.password, community: probe.community };
        matched = probe.label || null;
      }
    }
  }
  const dup = devices.findDuplicate(saveBody);
  if (dup) {
    return res.status(409).json({ error: `Already added as "${dup.name}" with this connection method. Delete it first or pick another method.` });
  }
  const lastTest = await transports.test(connectionInput(saveBody));
  if (lastTest.error === 'Invalid IP address or host name') return res.status(400).json({ error: lastTest.error });
  const added = devices.add(saveBody, lastTest);
  applyAutoName(added.id, lastTest);
  monitor.tick();
  res.json({ success: true, device: devices.publicView(devices.get(added.id)), test: lastTest, matched });
});

app.post('/api/devices/:id/check', async (req, res) => {
  const d = devices.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  const result = await transports.test(devices.connectionOptions(d));
  devices.update(d.id, {
    lastTest: result,
    status: { online: !!result.ok, checkedAt: new Date().toISOString() }
  });
  applyAutoName(d.id, result);
  res.json({ device: devices.publicView(devices.get(d.id)), test: result });
});

// Enable SNMP on a MikroTik (the only action that WRITES to a device). The browser confirms
// first; this logs in to the RouterOS API, turns SNMP on, ensures a read-only community exists,
// then verifies over SNMP and switches the device to SNMP monitoring if that worked.
const mikrotik = require('./src/transports/mikrotik');
const snmpTransport = require('./src/transports/snmp');
app.post('/api/devices/:id/enable-snmp', async (req, res) => {
  const d = devices.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  if (d.type !== 'mikrotik') return res.status(400).json({ error: 'Auto-enabling SNMP is only supported on MikroTik for now. On other devices, enable SNMP on the device, then add it with the SNMP method.' });

  const opts = devices.connectionOptions(d);
  const vault = credentials.resolved();
  // Pick the community: one the request named, else a saved community, else "public".
  let community = (req.body && req.body.community) ? String(req.body.community) : null;
  let communityLabel = community ? 'the one you entered' : null;
  if (!community && vault.communities.length) { community = vault.communities[0].community; communityLabel = '"' + vault.communities[0].label + '"'; }
  if (!community) { community = 'public'; communityLabel = 'the default "public"'; }

  // Log in to the RouterOS API with the device's saved login, falling back to the vault.
  const secure = opts.method === 'mikrotik-ssl';
  const apiPort = (opts.method === 'mikrotik' || opts.method === 'mikrotik-ssl') ? opts.port : undefined;
  const candidates = [{ username: opts.username, password: opts.password }].concat(vault.logins);
  let session = null;
  for (const c of candidates) {
    if (!c.password && !c.username) continue;
    try { session = await mikrotik.Session.open({ host: opts.host, port: apiPort, username: c.username, password: c.password, secure }); break; } catch (e) { /* try the next login */ }
  }
  if (!session) {
    return res.status(400).json({ error: 'Could not log in to the MikroTik API to change settings. On the router, enable IP → Services → api, make sure the login can write, then try again.' });
  }
  try {
    await mikrotik.enableSnmp(session, { community });
  } catch (e) {
    return res.status(502).json({ error: 'Logged in, but could not turn on SNMP: ' + (e.message || 'command failed') });
  } finally {
    session.close();
  }

  // Confirm SNMP answers, then switch monitoring to it. If it can't be read back yet, keep the
  // current method so monitoring never breaks.
  const verify = await snmpTransport.test({ host: opts.host, community, version: '2c', timeout: 4000 });
  let device = d;
  if (verify.ok) {
    device = devices.reconfigure(d.id, { method: 'snmp', community, port: null, lastTest: verify });
    applyAutoName(d.id, verify);
    monitor.tick();
  }
  res.json({
    enabled: true,
    verified: verify.ok,
    switched: verify.ok,
    communityLabel, // label only, never the community value
    device: devices.publicView(devices.get(d.id)),
    message: verify.ok
      ? 'SNMP is on and TowerDesk is now monitoring this router over SNMP using ' + communityLabel + '.'
      : 'SNMP was turned on with ' + communityLabel + ', but TowerDesk could not read it back yet (a firewall rule may block UDP 161). Monitoring is unchanged; press Check in a moment.'
  });
});

// One-click "Fix unconnected": for every device that is not already connected with data, try the
// saved vault logins / SNMP communities across the sensible methods and switch each one that works.
// Devices that already have a working authenticated connection (or live data) are left untouched,
// so this never re-probes the devices that are fine (and never risks a TP-Link lockout on them).
app.post('/api/devices/autoconnect', async (req, res) => {
  const vault = credentials.resolved();
  if (!vault.logins.length && !vault.communities.length) {
    return res.json({ checked: 0, connected: 0, noCommunities: true, results: [], note: 'Add at least one Saved Login or SNMP community first, then run this again.' });
  }
  const metrics = require('./src/metrics');
  const AUTH = /^(mikrotik|mikrotik-ssl|ssh|telnet|snmp|snmp1|tplink)$/;
  const candidates = devices.list().filter((d) => {
    if (!(d.lastTest && d.lastTest.ok)) return true; // not working -> try
    const mx = metrics.snapshot(devices.get(d.id));
    const hasData = mx && !mx.error && !mx.waiting && mx.interfaces && mx.interfaces.length;
    return !(AUTH.test(d.method) || hasData); // skip only the ones already truly connected
  });
  const run = async (d) => {
    try {
      const probe = await transports.probeCredentials({ host: d.ip, method: d.method, port: d.port, vendor: d.type, logins: vault.logins, communities: vault.communities, perTry: 3500 });
      if (!probe.ok) return { id: d.id, name: d.name, connected: false };
      devices.edit(d.id, { method: probe.method, port: probe.port, username: probe.username, password: probe.password, community: probe.community });
      const test = await transports.test(devices.connectionOptions(devices.get(d.id)));
      devices.update(d.id, { lastTest: test, status: { online: !!test.ok, checkedAt: new Date().toISOString() } });
      applyAutoName(d.id, test);
      metrics.forget(d.id);
      return { id: d.id, name: devices.get(d.id).name, connected: !!test.ok, method: probe.method, label: probe.label };
    } catch (e) {
      return { id: d.id, name: d.name, connected: false };
    }
  };
  // Bounded concurrency so a tower of radios is probed in parallel without flooding the link.
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (i < candidates.length) { const idx = i++; out[idx] = await run(candidates[idx]); }
  }));
  monitor.tick();
  res.json({ checked: out.length, connected: out.filter((r) => r && r.connected).length, noCommunities: !vault.communities.length, results: out });
});

// Edit a saved device from the detail panel: rename, or switch the monitoring method/login/
// community, then re-test with the new settings. Secrets never come back to the client.
app.put('/api/devices/:id', async (req, res) => {
  const d = devices.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  const body = req.body || {};
  if (body.method && !transports.METHODS[body.method]) return res.status(400).json({ error: 'Unknown connection method' });
  // Auto-fill from the vault when switching method with no password/community typed.
  if (body.tryVault && !body.password && !body.community) {
    const vault = credentials.resolved();
    if (vault.logins.length || vault.communities.length) {
      const probe = await transports.probeCredentials({ host: d.ip, method: body.method || d.method, port: body.port, vendor: body.type || d.type, logins: vault.logins, communities: vault.communities });
      if (probe.ok) { body.method = probe.method; body.port = probe.port; body.username = probe.username; body.password = probe.password; body.community = probe.community; }
    }
  }
  if (!devices.edit(d.id, body)) return res.status(404).json({ error: 'Device not found' });
  const test = await transports.test(devices.connectionOptions(devices.get(d.id)));
  devices.update(d.id, { lastTest: test, status: { online: !!test.ok, checkedAt: new Date().toISOString() } });
  applyAutoName(d.id, test);
  try { require('./src/metrics').forget(d.id); } catch (e) { /* ignore */ } // drop any stale session for the old method
  monitor.tick();
  res.json({ success: true, device: devices.publicView(devices.get(d.id)), test });
});

app.delete('/api/devices/:id', (req, res) => {
  if (!devices.remove(req.params.id)) return res.status(404).json({ error: 'Device not found' });
  alerts.forgetDevice(req.params.id);
  res.json({ success: true });
});

// ----- Network scan: find and identify devices in a private range (read-only) -----
const discovery = require('./src/discovery');
app.post('/api/discovery', (req, res) => {
  const body = req.body || {};
  try {
    res.status(202).json(discovery.start({ range: body.range, community: body.community || undefined }));
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});
app.get('/api/discovery/:id', (req, res) => {
  const job = discovery.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Scan not found' });
  res.json(job);
});
app.post('/api/discovery/:id/stop', (req, res) => {
  const job = discovery.stop(req.params.id);
  if (!job) return res.status(404).json({ error: 'Scan not found' });
  res.json(job);
});

// ----- Alerts raised by the live monitor -----
const alerts = require('./src/alerts');
app.get('/api/alerts', (req, res) => res.json({ summary: alerts.summary(), alerts: alerts.list(), latencyWarnMs: alerts.LATENCY_WARN_MS }));
app.get('/api/alerts/summary', (req, res) => res.json(alerts.summary()));
app.post('/api/alerts/:id/ack', (req, res) => {
  const a = alerts.acknowledge(req.params.id);
  if (!a) return res.status(404).json({ error: 'Alert not found' });
  res.json({ success: true, alert: a });
});

// Real-time monitoring: reachability + latency of every saved device (never logs in).
const monitor = require('./src/monitor');
monitor.start();

// Log out of device sessions (e.g. the TP-Link admin slot) when the server stops.
function shutdown() {
  try { require('./src/metrics').closeAll(); } catch (e) { /* ignore */ }
  try { require('./src/history').close(); } catch (e) { /* ignore */ }
  setTimeout(() => process.exit(0), 700).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Demo/mock mode (TOWERDESK_DEMO=1, or ?demo=1) serves a realistic sample tower so the dashboard
// can be shown without a live network — used by the portable trial build.
app.get('/api/monitor', (req, res) => {
  if (process.env.TOWERDESK_DEMO === '1' || (req.query && req.query.demo === '1')) {
    return res.json(require('./src/demo').snapshot());
  }
  res.json(monitor.snapshot());
});

// Persisted monitoring history for one device (survives restarts; SQLite-backed).
const history = require('./src/history');
app.get('/api/history/:id', (req, res) => {
  const d = devices.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 300));
  res.json({
    id: d.id,
    enabled: history.enabled(),
    uptime24hPct: history.uptimePct(d.id, 24 * 3600 * 1000),
    samples: history.recent(d.id, limit)
  });
});

// Self-updater (portable build). Checks a GitHub repo / manifest the operator configures and
// stages a new version; the launcher applies it on the next start. Nothing is fetched unless the
// operator asks (check / install).
const updater = require('./src/updater');
app.get('/api/update/status', (req, res) => res.json(updater.status()));
app.get('/api/update/config', (req, res) => res.json(updater.getConfig()));
app.post('/api/update/config', (req, res) => {
  try { res.json(updater.setConfig(req.body || {})); }
  catch (e) { res.status(400).json({ error: 'Could not save update settings' }); }
});
// check/install return 200 with an { error } field on failure (a missing source or an offline
// box is an expected outcome, not a server fault — the UI shows the message inline).
app.post('/api/update/check', async (req, res) => {
  try { res.json(await updater.check()); }
  catch (e) { res.json({ error: e.message }); }
});
app.post('/api/update/install', async (req, res) => {
  try {
    const url = (req.body && req.body.downloadUrl) || '';
    const marker = await updater.stage(url);
    res.json({ staged: true, version: marker.version });
  } catch (e) { res.json({ error: e.message }); }
});
app.post('/api/update/cancel', (req, res) => { updater.clearStaged(); res.json({ ok: true }); });

// RADIUS / SAS subscribers (the customer sessions authenticated against the tower's RADIUS or
// SAS server). Demo mode serves realistic sessions so the page works without a live server.
const subscribers = require('./src/subscribers');
app.get('/api/radius/subscribers', async (req, res) => {
  try {
    const demo = process.env.TOWERDESK_DEMO === '1' || (req.query && req.query.demo === '1');
    const out = await subscribers.list({ demo });
    // Trace each subscriber to the sector radio it is registered on (matched by MAC).
    const snap = demo ? require('./src/demo').snapshot() : monitor.snapshot();
    out.match = require('./src/lookup').attachStations(out.subscribers, snap.devices);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load subscribers' });
  }
});
app.get('/api/radius/config', (req, res) => res.json(subscribers.getConfig()));
app.post('/api/radius/config', (req, res) => {
  try {
    res.json(subscribers.setConfig(req.body || {}));
  } catch (e) {
    res.status(400).json({ error: 'Could not save RADIUS settings' });
  }
});

// Backup / restore of the data folder (Settings page). The download contains the saved logins
// and their key, so it is only ever sent to the signed-in operator who asked for it.
const backup = require('./src/backup');
app.get('/api/backup', (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', 'attachment; filename="towerdesk-backup-' + stamp + '.json"');
  res.setHeader('Cache-Control', 'no-store');
  res.json(backup.create(updater.currentVersion()));
});
app.post('/api/restore', express.json({ limit: '20mb' }), (req, res) => {
  try {
    const out = backup.restore(req.body);
    res.json({ ok: true, restored: out.restored.length, restartRequired: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Network tools (ping / traceroute from this computer). Always 200 with { ok, output | error }:
// an unreachable host is a normal answer, not a server fault.
app.post('/api/tools/:tool', async (req, res) => {
  res.json(await require('./src/tools').run(req.params.tool, req.body && req.body.host));
});

// Handle theme switching
app.use((req, res, next) => {
  const theme = req.query.theme || 'light';
  req.theme = theme;
  next();
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TowerDesk server running on http://localhost:${PORT}`);
});