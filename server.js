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
  const required = auth.isConfigured() && process.env.TOWERDESK_AUTH !== 'off';
  // With no login configured everyone is the owner; otherwise the role comes from the account.
  res.json({ authRequired: required, user: s ? s.user : null, role: required ? (s ? auth.roleOf(s.user) : null) : 'admin' });
});
app.use(auth.middleware);

// Staff accounts (admin only: see src/auth.js). Passwords and hashes are never sent back.
app.get('/api/users', (req, res) => res.json({ configured: auth.isConfigured(), me: req.user || null, users: auth.listUsers(), roles: auth.ROLES }));
app.post('/api/users', (req, res) => {
  const b = req.body || {};
  const first = !auth.isConfigured();
  if (first) {
    // Before any login exists the page is open to the network: only the computer running TowerDesk may create the first admin.
    const addr = String(req.socket.remoteAddress || '');
    const local = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(addr) && !req.headers['x-forwarded-for'] && !req.headers['cf-connecting-ip'];
    if (!local) return res.status(403).json({ error: 'Create the first account on the computer that runs TowerDesk.' });
  }
  const r = auth.createUser(b.username, b.password, b.role);
  if (r.error) return res.status(400).json(r);
  // Creating the very first account turns the login on: sign that person in so they are not locked out.
  if (first) { const sess = auth.startSession(req, res, r.username); return res.json(Object.assign({ firstAccount: true }, r, sess || {})); }
  res.json(r);
});
app.put('/api/users/:name', (req, res) => {
  const r = auth.updateUser(String(req.params.name), { role: req.body && req.body.role, password: req.body && req.body.password });
  if (r.error) return res.status(400).json(r);
  res.json(r);
});
app.delete('/api/users/:name', (req, res) => {
  const r = auth.removeUser(String(req.params.name), req.user);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

// Static folder for views and assets
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Overview page (the dashboard)
// Overview: live totals, what needs attention, links, sectors and top users.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/topology', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'topology.html'));
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

// Change how TowerDesk connects to ONE device, from its card: Auto (the saved default logins),
// SNMP, a username and password, or ping only. The connection is tried first and the device is
// only changed when it works. A password typed here is kept with the device (encrypted); with
// saveAsDefault it is also added to the saved default logins that Add Device tries. Nothing secret
// is ever returned.
app.post('/api/devices/:id/connect', async (req, res) => {
  const d = devices.get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Device not found' });
  const b = req.body || {};
  const mode = ['auto', 'login', 'snmp', 'ping'].includes(b.mode) ? b.mode : 'auto';
  const metricsMod = require('./src/metrics');
  const finish = async (patch, extra) => {
    devices.edit(d.id, patch);
    const test = await transports.test(devices.connectionOptions(devices.get(d.id)));
    devices.update(d.id, { lastTest: test, status: { online: !!test.ok, checkedAt: new Date().toISOString() } });
    applyAutoName(d.id, test);
    metricsMod.forget(d.id);
    monitor.tick();
    return Object.assign({ ok: !!test.ok, device: devices.publicView(devices.get(d.id)), test }, extra);
  };
  try {
    if (mode === 'ping') return res.json(await finish({ method: 'ping', port: null }));
    const vault = credentials.resolved();
    const typedLogin = (b.username || b.password) ? [{ username: String(b.username || '').slice(0, 64), password: String(b.password || '').slice(0, 200), label: 'typed here' }] : null;
    const typedCommunity = b.community ? [{ community: String(b.community).slice(0, 100), label: 'typed here' }] : null;
    const logins = mode === 'snmp' ? [] : (typedLogin || vault.logins);
    const communities = mode === 'login' ? [] : (typedCommunity || vault.communities);
    if (!logins.length && !communities.length) return res.json({ ok: false, needLogin: true, tried: 0, typed: false, mode });
    // A device typed as "other" has no vendor to guess methods from: look at it first.
    let vendor = d.type, method = d.method === 'ping' ? undefined : d.method;
    if (d.type === 'other') {
      const det = await transports.detect(d.ip);
      if (det && det.ok) { vendor = det.vendor || vendor; method = method || det.suggestedMethod; }
    }
    const probe = await transports.probeCredentials({ host: d.ip, method, port: d.port, vendor, logins, communities, perTry: 5000 });
    if (!probe.ok) return res.json({ ok: false, needLogin: true, tried: logins.length + communities.length, typed: !!(typedLogin || typedCommunity), mode });
    let savedAsDefault = false;
    if (b.saveAsDefault) {
      if (typedLogin && !vault.logins.some((l) => l.username === probe.username && l.password === probe.password)) {
        credentials.addLogin({ label: String(b.label || probe.username || 'login'), username: probe.username, password: probe.password });
        savedAsDefault = true;
      } else if (typedCommunity && !vault.communities.some((c) => c.community === probe.community)) {
        credentials.addCommunity({ label: String(b.label || 'community'), community: probe.community });
        savedAsDefault = true;
      }
    }
    const patch = { method: probe.method, port: probe.port, username: probe.username, password: probe.password, community: probe.community };
    if (d.type === 'other' && vendor && vendor !== 'other') patch.type = vendor;
    return res.json(await finish(patch, { matched: probe.label || null, savedAsDefault }));
  } catch (e) {
    return res.json({ ok: false, error: 'Could not try the connection.' });
  }
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

// Topology: place devices on a site and say what each one connects to. Saves only those two
// fields (no re-test, no change to how a device is monitored).
app.post('/api/topology/layout', (req, res) => {
  const changes = Array.isArray(req.body && req.body.changes) ? req.body.changes.slice(0, 200) : [];
  const done = [], errors = [];
  changes.forEach((c) => {
    const r = devices.setLayout(String((c && c.id) || ''), { location: c && c.location, parentId: c && c.parentId });
    if (r.error) errors.push({ id: c && c.id, error: r.error }); else done.push(c.id);
  });
  res.json({ ok: errors.length === 0, done, errors });
});

// Set up a radio from a template. Plan is read-only; apply needs the admin's "allow writing" switch (off by default).
const provision = require('./src/provision');
app.get('/provision', (req, res) => res.sendFile(path.join(__dirname, 'public', 'provision.html')));
app.get('/api/provision/settings', (req, res) => res.json(provision.settings()));
app.post('/api/provision/settings', (req, res) => res.json(provision.setAllowWrite(!!(req.body && req.body.allowWrite))));
app.post('/api/provision/plan', async (req, res) => { try { res.json(await provision.plan(req.body)); } catch (e) { res.json({ ok: false, error: String(e.message || 'Could not read the radio').slice(0, 240) }); } });
app.post('/api/provision/apply', async (req, res) => { try { res.json(await provision.apply(req.body)); } catch (e) { res.json({ ok: false, error: String(e.message || 'Not applied').slice(0, 240) }); } });
['keep', 'undo'].forEach((how) => app.post('/api/provision/' + how, async (req, res) => { try { res.json(await provision[how](String((req.body && req.body.host) || ''))); } catch (e) { res.json({ ok: false, error: String(e.message || 'It did not work').slice(0, 240) }); } }));
// Reach a MikroTik that has no IP through another MikroTik (MAC-Telnet). Plan is read-only; apply needs the same admin switch.
const macreach = require('./src/macreach');
app.post('/api/macreach/plan', async (req, res) => { try { res.json(await macreach.plan(req.body)); } catch (e) { res.json({ ok: false, error: String(e.message || 'Could not build the preview').slice(0, 240) }); } });
app.post('/api/macreach/apply', async (req, res) => { try { res.json(await macreach.apply(req.body)); } catch (e) { res.json({ ok: false, error: String(e.message || 'It did not work').slice(0, 300) }); } });
app.get('/api/provision/status', (req, res) => res.json(provision.status(String((req.query && req.query.host) || ''))));

// Finance (admin only): estimates from plan prices x active subscribers. SAS reports no payments.
const finance = require('./src/finance');
const financeModel = require('./public/finance-model.js');
app.get('/finance', (req, res) => res.sendFile(path.join(__dirname, 'public', 'finance.html')));
const DEMO_FINANCE = { currency: 'IQD', prices: { 'Home 10M': 15000, 'Home 20M': 25000, 'Pro 50M': 45000, 'Business 100M': 120000 }, expenses: [{ label: 'Bandwidth', monthly: 300000 }, { label: 'Power and rent', monthly: 100000 }, { label: 'Staff', monthly: 250000 }] };
app.get('/api/finance', async (req, res) => {
  try {
    const demo = process.env.TOWERDESK_DEMO === '1' || (req.query && req.query.demo === '1');
    const subs = await subscribers.list({ demo });
    const cfg = demo ? DEMO_FINANCE : finance.config();
    const summary = financeModel.compute(subs.subscribers || [], cfg);
    let history;
    if (demo) {
      // A believable month so the trend can be seen without waiting.
      history = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 86400000); return { date: d.toISOString().slice(0, 10), revenue: Math.round(summary.revenue * (0.9 + i * 0.0035)), expenses: summary.expenses, active: Math.max(1, summary.active - (29 - i) % 5) }; });
    } else {
      if (subs.configured !== false && (subs.subscribers || []).length) finance.record(summary);
      history = finance.snapshots();
    }
    res.json({ demo, sasConfigured: subs.configured !== false, config: cfg, summary, history, countryCode: notify.config().whatsapp.countryCode });
  } catch (e) { res.status(500).json({ error: 'Could not work out the finance figures' }); }
});
app.post('/api/finance/config', (req, res) => {
  const r = finance.setConfig(req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json({ ok: true, config: finance.config() });
});

// A note on a device (technicians and admins; the role rules already refuse viewers' writes).
app.post('/api/devices/:id/notes', (req, res) => {
  const r = devices.setNotes(req.params.id, req.body && req.body.notes);
  if (r.error) return res.status(404).json(r);
  res.json(r);
});

// Maintenance windows: mute alerts and messages for a device or a site for a set time.
const maintenance = require('./src/maintenance');
const notify = require('./src/notify');
const impactModel = require('./public/impact-model.js');
const messages = require('./public/messages-model.js');
app.get('/api/maintenance', (req, res) => res.json({ windows: maintenance.active() }));
app.post('/api/maintenance', (req, res) => {
  const b = req.body || {};
  const dev = b.id ? devices.get(String(b.id)) : null;
  if (b.scope !== 'site' && !dev) return res.status(404).json({ error: 'Device not found' });
  const r = maintenance.add({ scope: b.scope === 'site' ? 'site' : 'device', id: dev ? dev.id : undefined, site: b.site, hours: b.hours, reason: b.reason, name: dev ? dev.name : b.site, by: req.user || '' });
  if (r.error) return res.status(400).json(r);
  try { monitor.note({ kind: 'setting', id: dev ? dev.id : null, name: r.window.name, text: r.window.name + ': maintenance started' }); } catch (e) { /* optional */ }
  res.json(r);
});
app.delete('/api/maintenance/:id', (req, res) => {
  if (!maintenance.remove(String(req.params.id))) return res.status(404).json({ error: 'No such maintenance window' });
  res.json({ ok: true });
});

// Telegram settings (admin only). The token is never sent back.
app.get('/api/notify', (req, res) => res.json(notify.publicConfig()));
app.post('/api/notify/config', (req, res) => {
  const r = notify.setConfig(req.body || {});
  if (r.error) return res.status(400).json(r);
  res.json(Object.assign({ ok: true }, notify.publicConfig()));
});
app.post('/api/notify/test', async (req, res) => {
  const r = await notify.telegramSend('✅ TowerDesk test message. If you can read this, alerts will arrive here.');
  res.json(Object.assign({ ok: !!r.ok }, r.ok ? {} : { error: r.error }));
});

// Texts for the team and for customers. Nothing is sent from here: the page copies them or opens WhatsApp.
app.get('/api/messages/outage/:id', async (req, res) => {
  try {
    const demo = req.query && req.query.demo === '1';
    const snap = demo ? require('./src/demo').snapshot() : monitor.snapshot();
    const d = (snap.devices || []).find((x) => x.id === req.params.id);
    if (!d) return res.status(404).json({ error: 'Device not found' });
    const imp = impactModel.impact(snap.devices, d.id);
    const ids = new Set([d.id].concat(imp.devices));
    const subs = await subscribers.list({ demo });
    require('./src/lookup').attachStations(subs.subscribers, snap.devices);
    const cc = notify.config().whatsapp.countryCode;
    const kind = req.query && req.query.kind === 'maintenance' ? 'maintenance' : 'outage';
    const lang = req.query && req.query.lang === 'en' ? 'en' : 'ar';
    const w = d.maintenance;
    const text = messages.customerNotice(lang, kind, { until: w ? w.until : null });
    const customers = (subs.subscribers || []).filter((s) => s.station && ids.has(s.station.sectorId)).map((s) => ({
      name: s.name || s.username, username: s.username, phone: s.phone || '', online: !!s.online, link: messages.waLink(s.phone, text, cc)
    }));
    res.json({ countryCode: cc, device: { id: d.id, name: d.name }, impact: imp, sentence: impactModel.sentence(imp), kind, lang, text, customers, withPhone: customers.filter((c) => c.link).length });
  } catch (e) { res.status(500).json({ error: 'Could not build the message' }); }
});

// Neighbours: who sits next to whom, read from routers and switches (read-only), plus suggestions for the
// link diagram. GET shows what was read last; POST /scan reads the devices again now.
const neighbors = require('./src/neighbors');
function neighborView(demo) {
  if (demo) {
    const dm = require('./src/demo');
    const list = dm.snapshot().devices.map((d) => ({ id: d.id, name: d.name, ip: d.ip, type: d.type, parentId: d.parentId }));
    const a = neighbors.analyse(list, dm.neighborObservations(), {});
    return Object.assign({ demo: true, scannedAt: new Date().toISOString(), scanned: 1, canScan: 1 }, a);
  }
  const list = devices.list();
  const macs = {};
  (monitor.snapshot().devices || []).forEach((d) => { if (d.metrics && d.metrics.macs) macs[d.id] = d.metrics.macs; });
  const obs = neighbors.observations();
  const at = obs.map((o) => o.at).filter(Boolean).sort().pop() || null;
  return Object.assign({ demo: false, scannedAt: at, scanned: obs.length, canScan: list.filter(neighbors.canScan).length }, neighbors.analyse(list, obs, macs));
}
app.get('/api/neighbors', (req, res) => res.json(neighborView(req.query && req.query.demo === '1')));
// Every few hours the routers and switches are asked again (read-only), and a change in what is next to what is
// written to the Recent changes list. Off in demo mode and when nothing can be scanned.
const NEIGHBOR_EVERY_MS = 6 * 3600 * 1000;
async function scheduledNeighborScan() {
  try {
    if (process.env.TOWERDESK_DEMO === '1') return;
    const list = devices.list();
    if (!list.some(neighbors.canScan)) return;
    const before = neighborView(false).suggestions;
    await neighbors.scan(list, devices, { snmp: require('./src/transports/snmp'), mikrotik: require('./src/transports/mikrotik') });
    const after = neighborView(false).suggestions;
    const name = (id) => (list.find((d) => d.id === id) || {}).name;
    neighbors.diffSuggestions(before, after, (id) => (id === 'internet' ? 'the internet' : name(id))).forEach((c) => {
      try { monitor.note({ kind: 'device', id: c.id, name: name(c.id) || c.id, text: name(c.id) + ': ' + c.text }); } catch (e) { /* optional */ }
    });
  } catch (e) { /* a scan problem must never disturb the app */ }
}
if (!process.env.TOWERDESK_TEST) { setTimeout(scheduledNeighborScan, 3 * 60 * 1000).unref(); setInterval(scheduledNeighborScan, NEIGHBOR_EVERY_MS).unref(); }
app.post('/api/neighbors/scan', async (req, res) => {
  if (req.query && req.query.demo === '1') return res.json(Object.assign({ report: [] }, neighborView(true)));
  try {
    const report = await neighbors.scan(devices.list(), devices, { snmp: require('./src/transports/snmp'), mikrotik: require('./src/transports/mikrotik') }, req.body && req.body.id ? String(req.body.id) : undefined);
    res.json(Object.assign({ report }, neighborView(false)));
  } catch (e) { res.status(500).json({ error: 'The scan failed' }); }
});

app.delete('/api/devices/:id', (req, res) => {
  if (!devices.remove(req.params.id)) return res.status(404).json({ error: 'Device not found' });
  alerts.forgetDevice(req.params.id);
  require('./src/radio-history').forget(req.params.id);
  require('./src/neighbors').forget(req.params.id);
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

// Signal / CCQ history of one customer radio, by MAC address.
app.get('/api/history/station/:mac', (req, res) => {
  res.json({ enabled: history.enabled(), mac: req.params.mac, samples: history.stationHistory(req.params.mac) });
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

// Sector advisor. The built-in diagnosis is offline. AI advice is fetched only when the owner
// has saved a key and presses the button. Changes are applied only from a proposal the server
// itself produced and the owner accepted; the router undoes them on its own unless kept.
const advisor = require('./src/advisor');
const radio = require('./src/radio');
const isDemo = (req) => process.env.TOWERDESK_DEMO === '1' || (req.query && req.query.demo === '1');
const demoPending = new Map();
function advisorDevice(req) {
  const snap = isDemo(req) ? require('./src/demo').snapshot() : monitor.snapshot();
  const device = (snap.devices || []).find((d) => d.id === req.params.id);
  return { snap, device };
}
function demoStatus(id) {
  const p = demoPending.get(id);
  if (!p) return null;
  if (Date.now() >= p.revertAt) { demoPending.delete(id); return { expired: true, applied: p.applied }; }
  return { applied: p.applied, revertAt: p.revertAt, secondsLeft: Math.round((p.revertAt - Date.now()) / 1000), revertMinutes: radio.REVERT_MIN };
}
app.get('/api/ai/config', async (req, res) => {
  try { res.json(await advisor.status()); } catch (e) { res.json(advisor.getConfig()); }
});
app.post('/api/ai/config', (req, res) => {
  try { res.json(advisor.setConfig(req.body || {})); }
  catch (e) { res.status(400).json({ error: 'Could not save the AI settings' }); }
});
app.post('/api/advisor/:id', async (req, res) => {
  const { snap, device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const demo = isDemo(req);
  const lang = req.body && req.body.lang === 'ar' ? 'ar' : 'en';
  const useAi = !!(req.body && req.body.ai);
  try {
    const canApply = demo ? ['frequency', 'txPower'] : radio.capabilities(device);
    // Demo never calls the AI service: it shows a sample answer so the screen can be tried.
    const out = await advisor.advise(device, snap.devices, { canApply, useAi: useAi && !demo, lang });
    if (demo && useAi) {
      const ctx = advisor.context(device, snap.devices, canApply);
      out.ai = { summary: 'Sample answer (demo mode, nothing was sent anywhere). A few clients sit at the edge of this sector and it shares spectrum with one of your other radios.', causes: ['Channel overlap with your own radio on the same tower.', 'Two clients are far out or slightly off aim.'], manual: ['Realign the weakest client and check its cable.'], confidence: 'medium' };
      out.changes = advisor.sanitize(ctx, [
        { setting: 'frequency', to: (ctx.sector.frequencyMHz || 5180) + 40, reason: 'Moves this sector clear of your other radio on the same tower.', risk: 'Clients reconnect; allow about a minute.' },
        { setting: 'txPower', to: Math.max(3, (ctx.sector.txPowerDbm || 24) - 2), reason: 'Most clients are strong, so less power still reaches them.', risk: 'The weakest clients lose about 2 dB.' }
      ]);
      out.proposalId = out.changes.length ? advisor.remember(device.id, out.changes) : null;
    }
    out.hasKey = demo ? true : advisor.getConfig().hasKey;
    out.applyNote = demo ? null : radio.whyNot(device);
    out.experimental = demo ? (device.type === 'ubnt' || device.method === 'airos') : radio.experimental(device);
    out.pending = demo ? demoStatus(device.id) : radio.status(device.id);
    res.json(out);
  } catch (e) { res.json({ error: 'Could not check this sector' }); }
});
// ----- Channel suggestions and the change history of a radio -----
const radioHistory = require('./src/radio-history');
const demoHist = new Map();
function demoHistory(device, ctxFreq) {
  if (!demoHist.has(device.id)) {
    const f = ctxFreq || 5180;
    demoHist.set(device.id, [
      { t: new Date(Date.now() - 2 * 86400000).toISOString(), deviceId: device.id, deviceName: device.name, action: 'kept', changes: [{ setting: 'frequency', label: 'Frequency', unit: 'MHz', from: f - 40, to: f }] },
      { t: new Date(Date.now() - 3 * 86400000).toISOString(), deviceId: device.id, deviceName: device.name, action: 'undone', changes: [{ setting: 'txPower', label: 'Transmit power', unit: 'dBm', from: 24, to: 20 }] }
    ]);
  }
  return demoHist.get(device.id);
}
function demoRecord(device, action, changes) {
  const l = demoHistory(device);
  l.unshift({ t: new Date().toISOString(), deviceId: device.id, deviceName: device.name, action, changes });
}
function offer(req, device, snap, raw) {
  const demo = isDemo(req);
  const canApply = demo ? ['frequency', 'txPower'] : radio.capabilities(device);
  const ctx = advisor.context(device, snap.devices, canApply);
  const changes = advisor.sanitize(ctx, raw);
  return {
    changes, proposalId: changes.length ? advisor.remember(device.id, changes) : null, dropped: raw.length - changes.length,
    applyNote: demo ? null : radio.whyNot(device), experimental: demo ? (device.type === 'ubnt' || device.method === 'airos') : radio.experimental(device),
    pending: demo ? demoStatus(device.id) : radio.status(device.id)
  };
}
app.get('/api/advisor/:id/history', (req, res) => {
  const { snap, device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const ctx = advisor.context(device, snap.devices, []);
  res.json({ entries: isDemo(req) ? demoHistory(device, ctx.sector.frequencyMHz).slice(0, 30) : radioHistory.list(device.id, 30) });
});
app.post('/api/advisor/:id/channels', (req, res) => {
  const { snap, device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(advisor.channelPlan(advisor.context(device, snap.devices, [])));
});
app.post('/api/advisor/:id/channel', (req, res) => {
  const { snap, device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const ctx = advisor.context(device, snap.devices, []);
  const c = advisor.channelChange(ctx, req.body && req.body.frequencyMHz);
  if (!c) return res.json({ error: 'That channel is not one of the suggestions any more. Search again.' });
  res.json(offer(req, device, snap, [c]));
});
// Turn an entry of the history into a proposal: go back to what it was before, or do it again.
app.post('/api/advisor/:id/history-proposal', (req, res) => {
  const { snap, device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const demo = isDemo(req);
  const t = String((req.body && req.body.t) || '');
  const entry = demo ? demoHistory(device).find((e) => e.t === t) : radioHistory.find(device.id, t);
  if (!entry) return res.json({ error: 'That history entry was not found.' });
  const back = (req.body && req.body.mode) !== 'again';
  const when = new Date(entry.t).toLocaleString();
  const raw = entry.changes.filter((c) => (back ? c.from : c.to) != null).map((c) => ({
    setting: c.setting, to: back ? c.from : c.to,
    reason: back ? 'Puts it back to what it was before the change of ' + when + '.' : 'Repeats the change of ' + when + '.',
    risk: 'Clients reconnect; allow about a minute.'
  }));
  if (!raw.length) return res.json({ error: 'There is nothing to put back for that entry.' });
  const out = offer(req, device, snap, raw);
  if (!out.changes.length) out.error = 'The radio already has those values, or they are outside the safe limits.';
  res.json(out);
});

// Read-only: can this radio take a one-click change? Logs in and looks; changes nothing.
app.post('/api/advisor/:id/preflight', async (req, res) => {
  const { device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  if (isDemo(req)) return res.json({ ok: true, problems: [], frequency: 5500, txPower: 25, sample: true });
  try { res.json(await radio.preflight(device)); }
  catch (e) { res.json({ ok: false, problems: ['Could not check this radio.'] }); }
});
app.post('/api/advisor/:id/apply', async (req, res) => {
  const { device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const p = advisor.proposal(req.body && req.body.proposalId, device.id);
  if (!p) return res.json({ error: 'This proposal has expired. Check the sector again.' });
  const accept = Array.isArray(req.body && req.body.accept) ? req.body.accept.map(Number) : [];
  const chosen = p.changes.filter((c, i) => c.applicable && accept.includes(i));
  if (!chosen.length) return res.json({ error: 'No change was selected.' });
  try {
    let st;
    if (isDemo(req)) {
      const now = Date.now();
      demoRecord(device, 'applied', chosen.map((c) => ({ setting: c.setting, label: c.label, unit: c.unit, from: c.from, to: c.to })));
      demoPending.set(device.id, { applied: chosen.map((c) => ({ setting: c.setting, label: c.label, unit: c.unit, from: c.from, to: c.to })), revertAt: now + radio.REVERT_MIN * 60 * 1000 });
      st = demoStatus(device.id);
    } else {
      st = await radio.apply(device, chosen);
    }
    advisor.forget(req.body.proposalId);
    if (!isDemo(req)) monitor.note('setting', device.id, device.name, device.name + ': ' + chosen.map((c) => c.label + ' ' + (c.from == null ? '?' : c.from) + ' → ' + c.to + ' ' + c.unit).join(', ') + ' (applied, waiting to be kept)');
    res.json({ pending: st });
  } catch (e) { res.json({ error: e.message }); }
});
app.post('/api/advisor/:id/:action(keep|undo)', async (req, res) => {
  const { device } = advisorDevice(req);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  try {
    if (isDemo(req)) {
      const p = demoPending.get(device.id);
      if (p) demoRecord(device, req.params.action === 'keep' ? 'kept' : 'undone', p.applied);
      demoPending.delete(device.id);
      return res.json(req.params.action === 'keep' ? { kept: true } : { undone: true });
    }
    const result = req.params.action === 'keep' ? await radio.keep(device) : await radio.undo(device);
    monitor.note('setting', device.id, device.name, device.name + ': the radio change was ' + (req.params.action === 'keep' ? 'kept' : 'undone'));
    res.json(result);
  } catch (e) { res.json({ error: e.message }); }
});

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