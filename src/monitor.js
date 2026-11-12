// Real-time monitoring of saved devices. Every INTERVAL it checks reachability (ping or a TCP
// connect to the device's management port; never logs in), keeps a short latency history,
// and records online/offline changes as events.
const transports = require('./transports');
const devices = require('./devices');
const alerts = require('./alerts');
const metrics = require('./metrics');
const history = require('./history');
const { pairLinks } = require('./links');

const INTERVAL_MS = Number(process.env.TOWERDESK_MONITOR_MS) || 10000;
const HISTORY = 60;      // samples kept per device (10 minutes at 10 s)
const MAX_EVENTS = 100;

const state = new Map(); // id -> { samples: [{t, online, ms}], online, since }
const events = [];
let running = false;
let timer = null;
let lastRun = null;
let pruneCounter = 0;

function pushEvent(device, online) {
  events.unshift({ t: new Date().toISOString(), id: device.id, name: device.name, ip: device.ip, online });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

async function checkOne(device) {
  let r;
  try {
    r = await transports.reachable(device);
  } catch (e) {
    r = { online: false };
  }
  const now = Date.now();
  let s = state.get(device.id);
  if (!s) {
    // Seed the live sparkline from persisted history so a restart doesn't start blank.
    const seed = history.recent(device.id, HISTORY);
    s = { samples: seed, online: null, since: now };
    state.set(device.id, s);
  }
  if (s.online !== null && s.online !== r.online) pushEvent(device, r.online);
  if (s.online !== r.online) {
    s.since = now;
    // Persist only on change, so the file isn't rewritten every few seconds.
    devices.update(device.id, { status: { online: r.online, latencyMs: r.latencyMs, checkedAt: new Date(now).toISOString() } });
  }
  s.online = r.online;
  s.samples.push({ t: now, online: r.online, ms: r.online && Number.isFinite(r.latencyMs) ? r.latencyMs : null });
  if (s.samples.length > HISTORY) s.samples.shift();
  alerts.evaluate(device, { online: r.online, recentLatencies: s.samples.slice(-6).map((x) => x.ms) });
  // Traffic/CPU only while the device answers; drop the session while it's down.
  let rxBps = null, txBps = null, cpu = null;
  if (r.online) {
    await metrics.poll(device);
    const mx = metrics.snapshot(device);
    const role = roleOf(mx);
    if (role !== 'device' && device.role !== role) devices.update(device.id, { role }); // remember it
    if (mx && Array.isArray(mx.interfaces)) {
      rxBps = mx.interfaces.reduce((a, i) => a + (i.rxBps || 0), 0);
      txBps = mx.interfaces.reduce((a, i) => a + (i.txBps || 0), 0);
    }
    if (mx && mx.cpu && typeof mx.cpu.now === 'number') cpu = mx.cpu.now;
  } else {
    metrics.pause(device.id);
  }
  // Persist this poll so history (sparklines, uptime) survives a restart.
  history.record(device.id, {
    online: r.online,
    latencyMs: r.online && Number.isFinite(r.latencyMs) ? r.latencyMs : null,
    rxBps: rxBps, txBps: txBps, cpu: cpu
  });
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const list = devices.list();
    const ids = new Set(list.map((d) => d.id));
    for (const id of state.keys()) {
      if (!ids.has(id)) { state.delete(id); alerts.forgetDevice(id); metrics.forget(id); history.forget(id); }
    }
    await Promise.all(list.map(checkOne));
    lastRun = new Date().toISOString();
    // Drop samples past the retention window every ~5 minutes (30 ticks at 10 s).
    if ((pruneCounter = (pruneCounter + 1) % 30) === 0) history.prune(list.map((d) => d.id));
  } catch (e) {
    console.error('Monitor error:', e.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  tick();
  timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
}

// Classify a device from what its live metrics look like, so the UI can group the tower:
//   sector   — a point-to-multipoint AP serving connected stations
//   backhaul — one end of a point-to-point link (reports a remote end / link name)
//   device   — everything else (routers, ONUs, plain hosts)
function roleOf(mx) {
  if (!mx || mx.error) return 'device';
  const r = mx.radio || {};
  if (mx.kind === 'stations' || r.stations || (r.mode && /^ap/i.test(String(r.mode)))) return 'sector';
  if (r.remoteName || r.linkName || (r.mode && /^sta/i.test(String(r.mode)))) return 'backhaul';
  return 'device';
}

// Sticky role: prefer what the live metrics show; fall back to what the last successful test told
// us (a backhaul reports a remote end), then to a role we saved earlier — so the tower keeps its
// structure even while devices are offline.
function resolveRole(device, mx) {
  const live = roleOf(mx);
  if (live !== 'device') return live;
  const det = (device.lastTest && device.lastTest.details) || {};
  if (det.remote || det.link) return 'backhaul';
  return device.role || 'device';
}

function snapshot() {
  const list = devices.list().map((d) => {
    const s = state.get(d.id);
    const samples = s ? s.samples : [];
    const up = samples.filter((x) => x.online).length;
    const lat = samples.filter((x) => x.ms !== null).map((x) => x.ms);
    const last = samples[samples.length - 1];
    const mx = metrics.snapshot(d);
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      ip: d.ip,
      port: d.port,
      method: d.method,
      location: d.location,
      role: resolveRole(d, mx),
      provider: d.provider || null,
      peerId: d.peerId || null,
      online: s ? s.online : (d.status ? d.status.online : null),
      since: s ? new Date(s.since).toISOString() : null,
      latencyMs: last ? last.ms : null,
      avgLatencyMs: lat.length ? Math.round((lat.reduce((a, b) => a + b, 0) / lat.length) * 10) / 10 : null,
      uptimePct: samples.length ? Math.round((up / samples.length) * 1000) / 10 : null,
      uptime24hPct: history.uptimePct(d.id, 24 * 3600 * 1000),
      history: samples.map((x) => x.ms),
      metrics: mx,
      lastTest: d.lastTest ? { ok: d.lastTest.ok, summary: d.lastTest.summary, error: d.lastTest.error, details: d.lastTest.details } : null
    };
  });
  pairLinks(list);
  const online = list.filter((d) => d.online === true).length;
  const lats = list.map((d) => d.latencyMs).filter((x) => x !== null);
  return {
    intervalMs: INTERVAL_MS,
    lastRun,
    summary: {
      total: list.length,
      online,
      offline: list.filter((d) => d.online === false).length,
      avgLatencyMs: lats.length ? Math.round((lats.reduce((a, b) => a + b, 0) / lats.length) * 10) / 10 : null
    },
    devices: list,
    events: events.slice(0, 30)
  };
}

module.exports = { start, tick, snapshot, INTERVAL_MS };
