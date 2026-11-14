// Live traffic / CPU metrics for devices that expose them:
//  - MikroTik API (one persistent logged-in session per device)
//  - SNMP v1/v2c (IF-MIB counters)
// Rates are computed from byte-counter deltas between polls. Read-only.
const devices = require('./devices');
const mikrotik = require('./transports/mikrotik');
const snmp = require('./transports/snmp');
const tplink = require('./transports/tplink');
const airos = require('./transports/airos');
const mimosa = require('./transports/mimosa');
const olt = require('./transports/olt');

const BUSY_BACKOFF_MS = 60 * 1000;     // someone is using the router's web page
const LOCKED_BACKOFF_MS = 30 * 60 * 1000;

const HISTORY = 60;
const MAX_IFACES = 32;
const AUTH_BACKOFF_MS = 10 * 60 * 1000; // after a failed login, wait before retrying (avoid lockouts)
const ERROR_BACKOFF_MS = 30 * 1000;

const state = new Map(); // id -> per-device metrics state

// TP-Link web login: explicit method, or a TP-Link added via "Web UI" with its password saved.
function isTplink(device) {
  return device.method === 'tplink' || (device.type === 'tplink' && /^https?$/.test(device.method) && device.hasPassword);
}

function isAiros(device) {
  return device.method === 'airos';
}

function isMimosa(device) {
  return device.method === 'mimosa' || (device.type === 'mimosa' && /^https?$/.test(device.method) && device.hasPassword);
}

function supports(device) {
  return ['mikrotik', 'mikrotik-ssl', 'snmp', 'snmp1'].includes(device.method) || isTplink(device) || isAiros(device) || isMimosa(device);
}

function getState(id) {
  let s = state.get(id);
  if (!s) {
    s = { session: null, backoffUntil: 0, error: null, prev: {}, ifaces: {}, cpu: [], mem: null, uptime: null, lastPoll: null };
    state.set(id, s);
  }
  return s;
}

function push(arr, v) {
  arr.push(v);
  if (arr.length > HISTORY) arr.shift();
}

function applyCounters(s, list, now) {
  const seen = new Set();
  for (const i of list.slice(0, MAX_IFACES)) {
    seen.add(i.name);
    const prev = s.prev[i.name];
    s.prev[i.name] = { rx: i.rxBytes, tx: i.txBytes, t: now };
    let iface = s.ifaces[i.name];
    if (!iface) iface = s.ifaces[i.name] = { name: i.name, type: i.type, up: i.up, rx: [], tx: [] };
    iface.up = i.up;
    if (!prev) continue; // need two samples for a rate
    const dt = (now - prev.t) / 1000;
    if (dt <= 0) continue;
    const delta = (cur, old) => {
      let d = cur - old;
      if (d < 0) d = i.counterBits === 32 ? d + 4294967296 : null; // 32-bit wrap; 64-bit reset → skip
      return d === null ? null : Math.round((d * 8) / dt);
    };
    push(iface.rx, delta(i.rxBytes, prev.rx));
    push(iface.tx, delta(i.txBytes, prev.tx));
  }
  for (const name of Object.keys(s.ifaces)) {
    if (!seen.has(name)) { delete s.ifaces[name]; delete s.prev[name]; }
  }
}

async function pollMikrotik(device, s, now) {
  if (!s.session || s.session.closed) {
    const opts = devices.connectionOptions(devices.get(device.id) || device);
    s.session = await mikrotik.Session.open({ host: opts.host, port: opts.port || undefined, username: opts.username, password: opts.password, secure: device.method === 'mikrotik-ssl' });
  }
  const ifaces = await mikrotik.readInterfaces(s.session);
  const sys = await mikrotik.readSystem(s.session);
  applyCounters(s, ifaces.map((i) => ({ ...i, counterBits: 64 })), now);
  if (sys.cpuLoad !== undefined) push(s.cpu, sys.cpuLoad);
  s.mem = sys.totalMemory ? Math.round(((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100) : null;
  s.uptime = sys.uptime || null;
  // Wireless registration table (a MikroTik sector). Probed once: a router with no wireless
  // menu is remembered and never asked again, so it costs nothing on plain routers.
  if (s.regCommand !== false) {
    let reg;
    try {
      reg = await mikrotik.readRegistration(s.session, s.regCommand);
    } catch (e) {
      // The connection dropped while probing (e.g. a router that never answers the menu): stop
      // asking, so a quirky router cannot turn every poll into a reconnect.
      if (!s.regCommand) s.regCommand = false;
      throw e;
    }
    s.regCommand = reg ? reg.command : false;
    applyStations(s, reg ? reg.stations : [], now);
    // A sector's own radio settings (frequency, width, power), for the detail card and the
    // advisor. Only asked of routers that actually serve stations.
    // Best effort: a router that does not answer this must never break monitoring, so a failure
    // is remembered (like regCommand) and the question is not asked again on this connection.
    if (reg && reg.stations.length && /\/wireless\//.test(reg.command) && s.wirelessRead !== false) {
      try {
        const w = await mikrotik.readWireless(s.session);
        s.radio = w ? { mode: 'ap', essid: w.ssid, freq: w.frequency ? w.frequency + ' MHz' : undefined, chanbw: w.channelWidth || undefined, txpower: w.txPower === null ? undefined : w.txPower, stations: reg.stations.length } : null;
      } catch (e) {
        s.wirelessRead = false;
        s.radio = null;
      }
    }
  }
}

// Connected stations of an access point, with live per-station throughput from byte-counter
// deltas (same idea as interfaces). No stations -> not a sector.
function applyStations(s, stations, now) {
  if (!stations || !stations.length) {
    s.stations = null;
    if (s.kind === 'stations') s.kind = null;
    return;
  }
  s.staPrev = s.staPrev || {};
  s.stations = stations.map((c) => {
    let rxBps, txBps;
    if (c.rxBytes !== undefined && c.txBytes !== undefined) {
      const p = s.staPrev[c.mac];
      if (p && now > p.t) {
        const dt = (now - p.t) / 1000;
        rxBps = Math.max(0, Math.round(((c.rxBytes - p.rx) * 8) / dt));
        txBps = Math.max(0, Math.round(((c.txBytes - p.tx) * 8) / dt));
      }
      s.staPrev[c.mac] = { rx: c.rxBytes, tx: c.txBytes, t: now };
    }
    return { name: c.name, ip: c.ip, mac: c.mac, signal: c.signal, ccq: c.ccq, txRate: c.txRate, rxRate: c.rxRate, platform: c.platform, rxBps, txBps };
  }).sort((a, b) => (b.rxBps || 0) + (b.txBps || 0) - ((a.rxBps || 0) + (a.txBps || 0)));
  const macs = new Set(stations.map((x) => x.mac));
  for (const m of Object.keys(s.staPrev)) if (!macs.has(m)) delete s.staPrev[m];
  s.kind = 'stations';
  s.lastStationCount = stations.length; // kept so an offline sector can still say how many customers depend on it
}

async function pollTplink(device, s) {
  if (!s.session || s.session.closed) {
    const opts = devices.connectionOptions(devices.get(device.id) || device);
    s.session = await tplink.TplinkSession.open({
      host: opts.host,
      port: device.method === 'https' ? (opts.port || 443) : (opts.port || 80),
      secure: device.method === 'https',
      password: opts.password
    });
  }
  const st = await tplink.readStats(s.session);
  if (st.cpu !== undefined) push(s.cpu, st.cpu);
  s.mem = st.mem !== undefined ? st.mem : null;
  s.uptime = st.wanUptime ? formatSecs(st.wanUptime) : null;
  s.kind = 'clients';
  if (st.clients) {
    // The router reports live speeds per client in bytes/s; the total is the router's LAN traffic.
    const down = st.clients.reduce((a, c) => a + c.downBytes, 0) * 8;
    const up = st.clients.reduce((a, c) => a + c.upBytes, 0) * 8;
    let total = s.ifaces['All devices'];
    if (!total) total = s.ifaces['All devices'] = { name: 'All devices', up: true, rx: [], tx: [] };
    push(total.rx, down);
    push(total.tx, up);
    s.clients = st.clients
      .map((c) => ({ name: c.name, ip: c.ip, link: c.link, rxBps: c.downBytes * 8, txBps: c.upBytes * 8 }))
      .sort((a, b) => (b.rxBps + b.txBps) - (a.rxBps + a.txBps));
  } else {
    s.clients = null;
  }
}

function formatSecs(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const d = Math.floor(n / 86400), h = Math.floor((n % 86400) / 3600), m = Math.floor((n % 3600) / 60);
  return (d ? d + 'd ' : '') + h + 'h ' + m + 'm';
}

async function pollAiros(device, s, now) {
  if (!s.session || s.session.closed) {
    const opts = devices.connectionOptions(devices.get(device.id) || device);
    s.session = await airos.AirosSession.connect({ host: opts.host, port: opts.port || undefined, username: opts.username || 'ubnt', password: opts.password });
  }
  const st = await s.session.readStats();
  applyCounters(s, st.interfaces, now);
  if (st.cpu !== undefined) push(s.cpu, st.cpu);
  s.mem = st.memPct !== undefined ? st.memPct : null;
  s.uptime = st.uptime ? formatSecs(st.uptime) : null;
  s.signal = st.signal;
  s.ccq = st.ccq;
  s.radio = st.radio || null;
  s.macs = st.macs || s.macs;
  s.model = st.model || s.model;
  // Point-to-multipoint AP: the connected-subscriber list. Point-to-point links report none.
  applyStations(s, st.stations, now);
}

async function pollMimosa(device, s, now) {
  if (!s.session || s.session.closed) {
    const opts = devices.connectionOptions(devices.get(device.id) || device);
    s.session = await mimosa.MimosaSession.connect({ host: opts.host, port: opts.port || undefined, password: opts.password });
  }
  const st = await s.session.readStats();
  s.radio = st.radio;
  s.signal = st.radio.signal;
  s.model = st.model || s.model;
  // Mimosa reports a live throughput rate (Mbps), not byte counters, so push it straight into a
  // single "Link" series for the traffic chart.
  if (st.throughput !== undefined && st.throughput !== null) {
    let iface = s.ifaces.Link;
    if (!iface) iface = s.ifaces.Link = { name: 'Link', up: st.radio.connected !== false, rx: [], tx: [] };
    iface.up = st.radio.connected !== false;
    push(iface.rx, Math.round(st.throughput * 1e6));
    push(iface.tx, 0);
  }
}

async function pollSnmp(device, s, now) {
  const opts = devices.connectionOptions(devices.get(device.id) || device);
  const ifaces = await snmp.readInterfaces({ host: opts.host, port: opts.port || 161, community: opts.community, version: device.method === 'snmp1' ? '1' : '2c' });
  applyCounters(s, ifaces, now);
  await pollOnus(device, s, now, { host: opts.host, port: opts.port || 161, community: opts.community, version: device.method === 'snmp1' ? '1' : '2c' });
}

// An OLT's ONU list (optical power, temperature). Walking it is heavy, so it runs once a minute
// rather than on every poll. A plain SNMP device is probed once and then left alone; one added
// as an OLT is retried, since an OLT can simply have no ONU online at that moment.
const ONU_EVERY_MS = 60 * 1000;
const ONU_RETRY_MS = 10 * 60 * 1000;
async function pollOnus(device, s, now, conn) {
  if (s.oltProfile === false || now < (s.onuNext || 0)) return;
  s.onuNext = now + ONU_EVERY_MS;
  let res;
  try {
    res = await olt.readOnus(conn, s.oltProfile || undefined);
  } catch (e) {
    return; // keep the last list; the interface read already proved the device answers
  }
  if (!res) {
    if (s.oltProfile) { s.onus = []; return; }
    if (device.type === 'olt') s.onuNext = now + ONU_RETRY_MS; else s.oltProfile = false;
    return;
  }
  s.oltProfile = res.profile;
  s.oltLabel = res.label;
  // Weakest light first: those are the ones worth looking at. Offline ONUs go last.
  const rank = (o) => (o.online ? (o.signal === null ? 0 : o.signal) : 1000);
  s.onus = res.onus.sort((a, b) => rank(a) - rank(b));
  s.kind = 'onus';
}

async function poll(device) {
  if (!supports(device)) return;
  const s = getState(device.id);
  const now = Date.now();
  if (now < s.backoffUntil) return;
  try {
    if (isTplink(device)) await pollTplink(device, s);
    else if (isAiros(device)) await pollAiros(device, s, now);
    else if (isMimosa(device)) await pollMimosa(device, s, now);
    else if (device.method.startsWith('mikrotik')) await pollMikrotik(device, s, now);
    else await pollSnmp(device, s, now);
    s.error = null;
    s.lastPoll = new Date(now).toISOString();
  } catch (err) {
    closeSession(s);
    if (err instanceof tplink.TplinkError) {
      s.error = err.message;
      const wait = { auth: AUTH_BACKOFF_MS, locked: LOCKED_BACKOFF_MS, busy: BUSY_BACKOFF_MS, expired: 0 }[err.kind];
      s.backoffUntil = now + (wait === undefined ? ERROR_BACKOFF_MS : wait);
      if (err.kind === 'expired') s.error = null; // just log in again next poll
      return;
    }
    if (err instanceof airos.AirosError) {
      s.error = err.kind === 'auth' ? 'Login failed — check the saved username/password' : 'Could not read airOS: ' + err.message;
      s.backoffUntil = now + (err.kind === 'auth' ? AUTH_BACKOFF_MS : err.kind === 'expired' ? 0 : ERROR_BACKOFF_MS);
      if (err.kind === 'expired') s.error = null; // just log in again next poll
      return;
    }
    if (err instanceof mimosa.MimosaError) {
      s.error = err.kind === 'auth' ? 'Login failed — check the saved Mimosa password' : 'Could not read Mimosa: ' + err.message;
      s.backoffUntil = now + (err.kind === 'auth' ? AUTH_BACKOFF_MS : err.kind === 'expired' ? 0 : ERROR_BACKOFF_MS);
      if (err.kind === 'expired') s.error = null;
      return;
    }
    const auth = mikrotik.isAuthError(err);
    s.error = auth ? 'Login failed — check the saved username/password' : 'Could not read metrics: ' + (err.code || err.message || 'error');
    s.backoffUntil = now + (auth ? AUTH_BACKOFF_MS : ERROR_BACKOFF_MS);
  }
}

function closeSession(s) {
  if (!s.session) return;
  // TP-Link sessions are logged out politely so the router's single admin slot is freed.
  if (typeof s.session.logout === 'function') s.session.logout().catch(() => {});
  else s.session.close();
  s.session = null;
}

// Called when the device goes offline or is removed.
function pause(id) {
  const s = state.get(id);
  if (s) closeSession(s);
}

// Log out of every device session (called on server shutdown).
function closeAll() {
  for (const s of state.values()) closeSession(s);
}

function forget(id) {
  pause(id);
  state.delete(id);
}

function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
}

function snapshot(device) {
  if (!supports(device)) return null;
  const s = state.get(device.id);
  if (!s) return { source: device.method, interfaces: [], cpu: null, error: null, waiting: true };
  const ifaces = Object.values(s.ifaces).map((i) => ({
    name: i.name,
    type: i.type,
    up: i.up,
    rxBps: last(i.rx),
    txBps: last(i.tx),
    peak: Math.max(0, ...i.rx.filter((v) => v !== null), ...i.tx.filter((v) => v !== null)),
    rx: i.rx,
    tx: i.tx
  }));
  // Busiest first (by recent peak), then up before down.
  ifaces.sort((a, b) => b.peak - a.peak || (b.up ? 1 : 0) - (a.up ? 1 : 0));
  return {
    source: isTplink(device) ? 'TP-Link web login' : isAiros(device) ? 'Ubiquiti airOS' : isMimosa(device) ? 'Mimosa' : device.method.startsWith('mikrotik') ? 'MikroTik API' : 'SNMP',
    kind: s.kind || 'interfaces',
    signal: s.signal !== undefined ? s.signal : null,
    ccq: s.ccq !== undefined ? s.ccq : null,
    radio: s.radio || null,
    macs: s.macs || null,
    stations: s.stations ? s.stations.slice(0, 64) : null,
    stationCount: s.stations ? s.stations.length : null,
    stationCountLast: s.lastStationCount != null ? s.lastStationCount : null,
    onus: s.onus ? s.onus.slice(0, 512) : null,
    onuCount: s.onus ? s.onus.length : null,
    onuOnline: s.onus ? s.onus.filter((o) => o.online).length : null,
    oltLabel: s.oltLabel || null,
    clients: s.clients ? s.clients.slice(0, 8) : null,
    clientCount: s.clients ? s.clients.length : null,
    lastPoll: s.lastPoll,
    error: s.error,
    cpu: s.cpu.length ? { now: s.cpu[s.cpu.length - 1], history: s.cpu.slice() } : null,
    memPct: s.mem,
    uptime: s.uptime,
    waiting: !ifaces.some((i) => i.rx.length),
    interfaces: ifaces.slice(0, 6)
  };
}

module.exports = { supports, poll, pause, forget, snapshot, closeAll };
