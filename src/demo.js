// Mock monitor snapshot for demos / the portable trial build, so the full dashboard (backhaul
// links, sectors with connected clients, devices) renders without a live network or VPN.
// Shape matches src/monitor.js snapshot() exactly. Values wiggle each poll so charts look live.

const START = Date.now();

function wave(n, base, amp, period, phase) {
  const out = [];
  const t = (Date.now() - START) / 1000;
  for (let i = 0; i < n; i++) {
    const x = (i - n) * 2 + t;
    out.push(Math.max(0, Math.round(base + amp * Math.sin((x / period) + (phase || 0)) + amp * 0.25 * Math.sin(x / 7))));
  }
  return out;
}
function latHist(n, base, jitter, downs) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (downs && downs.indexOf(i) >= 0) { out.push(null); continue; }
    out.push(Math.round(base + jitter * Math.sin(i / 3) + jitter * 0.4 * Math.sin(i / 1.3)));
  }
  return out;
}
function iface(name, up, rxBase, txBase) {
  const rx = wave(60, rxBase, rxBase * 0.35, 9, 0);
  const tx = wave(60, txBase, txBase * 0.4, 11, 1.5);
  return { name, up, rxBps: rx[rx.length - 1], txBps: tx[tx.length - 1], peak: Math.max.apply(null, rx.concat(tx)), rx, tx };
}
function clients(list) {
  return list.map((c) => ({ name: c[0], ip: c[1], link: c[2] + ' dBm', rxBps: Math.round(c[3] * 1e6), txBps: Math.round(c[4] * 1e6) }));
}
function since(days, hours) { return new Date(START - ((days * 24 + (hours || 0)) * 3600 * 1000)).toISOString(); }

// ---- Backhaul links (one managed end at the tower, master shown from its remote data) ----
function backhaul(o) {
  const tp = wave(60, o.mbps, o.mbps * 0.3, 10, 0);
  const now = tp[tp.length - 1];
  return {
    id: o.id, name: o.name, type: o.type, ip: o.ip, port: null, method: o.method, location: o.loc, role: 'backhaul', provider: o.provider,
    online: o.online, since: o.online ? since(o.days, o.hours) : since(0, 0),
    latencyMs: o.online ? o.lat : null, avgLatencyMs: o.online ? o.lat + 1 : null,
    uptimePct: o.online ? 99.9 : 0, history: latHist(60, o.lat || 3, 1, o.online ? [] : [55, 56, 57, 58, 59]),
    lastTest: { ok: o.online, summary: o.name + ' — ' + o.model, details: { model: o.model, remote: o.remote, link: o.link, signal: o.signal + ' dBm' } },
    metrics: {
      source: o.source, kind: 'interfaces',
      radio: {
        signal: o.signal, noise: o.noise, snr: o.signal - o.noise, ccq: o.ccq, txRate: o.txr, rxRate: o.rxr,
        freq: o.freq + ' MHz', chanbw: o.bw, txpower: o.txp, temp: o.temp,
        linkName: o.link, distance: o.dist, availability: o.avail, connected: o.online,
        throughput: now, remoteName: o.remote, remoteModel: o.remoteModel
      },
      interfaces: [iface('Link', o.online, Math.round(now * 1e6 * 0.78), Math.round(now * 1e6 * 0.22))],
      cpu: { now: o.cpu, history: wave(30, o.cpu, 6, 8, 0) }, memPct: o.mem, uptime: o.online ? o.days + 'd ' + (o.hours || 0) + 'h' : null,
      signal: o.signal, ccq: o.ccq === undefined ? null : o.ccq, stations: null, stationCount: null, clients: null, clientCount: null,
      waiting: false, error: null
    }
  };
}

// ---- Sectors (point-to-multipoint APs with connected subscriber clients) ----
function sector(o) {
  const total = iface('Clients total', o.online, Math.round(o.mbps * 1e6 * 0.8), Math.round(o.mbps * 1e6 * 0.2));
  return {
    id: o.id, name: o.name, type: 'ubnt', ip: o.ip, port: null, method: 'airos', location: o.loc, role: 'sector', provider: o.provider,
    online: o.online, since: o.online ? since(o.days, 0) : since(0, 0),
    latencyMs: o.online ? o.lat : null, avgLatencyMs: o.online ? o.lat + 1 : null,
    uptimePct: o.online ? 99.6 : 0, history: latHist(60, o.lat || 4, 1.4, o.online ? [] : [50, 51, 52]),
    lastTest: { ok: o.online, summary: o.name + ' — ' + o.model, details: { model: o.model, signal: o.signal + ' dBm', firmware: o.fw } },
    metrics: {
      source: 'Ubiquiti airOS', kind: 'clients',
      radio: {
        signal: o.signal, noise: o.noise, snr: o.signal - o.noise, ccq: o.ccq, txRate: o.txr, rxRate: o.rxr,
        freq: o.freq + ' MHz', chanbw: o.bw, txpower: o.txp, mode: 'ap', essid: o.essid, stations: o.clients.length
      },
      interfaces: [total],
      clients: clients(o.clients), clientCount: o.clients.length,
      cpu: { now: o.cpu, history: wave(30, o.cpu, 5, 9, 1) }, memPct: o.mem, uptime: o.online ? o.days + 'd' : null,
      signal: o.signal, ccq: o.ccq, stationCount: o.clients.length,
      waiting: false, error: null
    }
  };
}

// ---- Plain devices (router, ONU) ----
function device(o) {
  return {
    id: o.id, name: o.name, type: o.type, ip: o.ip, port: o.port || null, method: o.method, location: o.loc, role: 'device', provider: o.provider,
    online: o.online, since: o.online ? since(o.days, 0) : since(0, 0),
    latencyMs: o.online ? o.lat : null, avgLatencyMs: o.online ? o.lat + 1 : null,
    uptimePct: o.online ? 100 : 0, history: latHist(60, o.lat || 2, 0.8, o.online ? [] : [57, 58, 59]),
    lastTest: { ok: o.online, summary: o.summary, details: o.details || {} },
    metrics: o.metrics || null
  };
}

function build() {
  const devices = [
    backhaul({ id: 'bh1', provider: 'HRINS core', name: 'North backhaul', type: 'mimosa', ip: '10.90.0.2', method: 'mimosa', loc: 'Tower roof', online: true, days: 41, hours: 6, lat: 3, model: 'C5c', source: 'Mimosa', remote: 'ISP core (Mansia)', remoteModel: 'B5c', link: 'core-north', signal: -42, noise: -71, txr: 300, rxr: 390, freq: 6340, bw: 80, txp: 24, temp: 52, dist: 7.2, avail: 99.98, mbps: 148, cpu: 22, mem: 38 }),
    backhaul({ id: 'bh2', provider: 'Horizon Telecom', name: 'East backhaul', type: 'ubnt', ip: '10.90.0.6', method: 'airos', loc: 'Tower roof', online: true, days: 12, hours: 2, lat: 5, model: 'airFiber 5XHD', source: 'Ubiquiti airOS', remote: 'Horizon POP', remoteModel: 'airFiber', link: 'horizon-east', signal: -56, noise: -92, ccq: 94, txr: 360, rxr: 300, freq: 5700, bw: 40, txp: 22, temp: 47, dist: 11.4, avail: 99.2, mbps: 72, cpu: 16, mem: 41 }),
    sector({ id: 's1', provider: 'HRINS core', name: 'Sector North', ip: '10.90.1.1', loc: 'Tower roof', online: true, days: 22, lat: 4, model: 'NanoStation 5AC', fw: 'XC.v8.7.11', signal: -53, noise: -94, ccq: 96, txr: 300, rxr: 300, freq: 5180, bw: 40, txp: 24, essid: 'HRINS-N', mbps: 88, cpu: 28, mem: 44,
      clients: [['ek2@cr', '10.81.61.128', -61, 4.2, 0.3], ['fag@cr', '10.81.61.106', -44, 1.1, 0.1], ['fahmi@cr', '10.82.155.107', -42, 0.0, 0.0], ['fathel@cr', '10.81.61.177', -50, 0.1, 1.0], ['zuhair@cr', '10.81.61.44', -58, 2.3, 0.2], ['noor@cr', '10.81.61.90', -47, 0.8, 0.1]] }),
    sector({ id: 's2', provider: 'HRINS core', name: 'Sector West', ip: '10.90.1.2', loc: 'Tower roof', online: true, days: 6, lat: 7, model: 'LiteAP AC', fw: 'XC.v8.7.11', signal: -58, noise: -88, ccq: 71, txr: 260, rxr: 240, freq: 5500, bw: 40, txp: 25, essid: 'HRINS-W', mbps: 31, cpu: 35, mem: 52,
      clients: [['sami@cr', '10.81.62.12', -64, 1.2, 0.2], ['rana@cr', '10.81.62.30', -59, 0.4, 0.1], ['omar@cr', '10.81.62.51', -71, 0.1, 0.0]] }),
    sector({ id: 's3', provider: 'Horizon Telecom', name: 'Sector South', ip: '10.90.1.3', loc: 'Tower roof', online: false, days: 0, lat: 0, model: 'Rocket 5AC', fw: 'XC.v8.7.11', signal: -70, noise: -90, ccq: 0, txr: 0, rxr: 0, freq: 5745, bw: 40, txp: 25, essid: 'HRINS-S', mbps: 0, cpu: 0, mem: 0, clients: [] }),
    device({ id: 'd1', provider: 'HRINS core', name: 'Core router', type: 'mikrotik', ip: '10.90.0.1', method: 'mikrotik', loc: 'Cabinet', online: true, days: 63, lat: 1, summary: 'RouterOS 7.14 on RB5009',
      details: { model: 'RB5009', version: '7.14', uptime: '63d 4h' },
      metrics: { source: 'MikroTik API', kind: 'interfaces', radio: null, interfaces: [iface('ether1 (WAN)', true, 190e6, 54e6), iface('sfp-sfpplus1', true, 210e6, 60e6), iface('ether2', true, 8e6, 3e6)], cpu: { now: 18, history: wave(30, 18, 7, 8, 0) }, memPct: 34, uptime: '63d 4h', signal: null, ccq: null, stations: null, stationCount: null, clients: null, clientCount: null, waiting: false, error: null } }),
    device({ id: 'd2', provider: 'HRINS core', name: 'Fiber ONU', type: 'onu', ip: '10.90.0.9', method: 'ping', loc: 'Cabinet', online: true, days: 29, lat: 2, summary: 'Replies to ping (2 ms)', details: {}, metrics: null })
  ];

  const online = devices.filter((d) => d.online === true).length;
  const lats = devices.map((d) => d.latencyMs).filter((x) => x !== null);
  return {
    demo: true,
    intervalMs: 10000,
    lastRun: new Date().toISOString(),
    summary: {
      total: devices.length,
      online,
      offline: devices.filter((d) => d.online === false).length,
      avgLatencyMs: lats.length ? Math.round((lats.reduce((a, b) => a + b, 0) / lats.length) * 10) / 10 : null
    },
    devices,
    events: [
      { t: new Date(START - 6 * 60000).toISOString(), id: 's3', name: 'Sector South', ip: '10.90.1.3', online: false },
      { t: new Date(START - 92 * 60000).toISOString(), id: 's3', name: 'Sector South', ip: '10.90.1.3', online: true }
    ]
  };
}

module.exports = { snapshot: build };
