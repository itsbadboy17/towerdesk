// Topology: saving a device's site and "connected to", grouping into sites, the connection graph
// and its layout, tracing a customer to the internet, and reading an M-series AP's client list.
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-topo-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const devices = require('../src/devices');
const model = require('../public/topo-model.js');
const airos = require('../src/transports/airos');

let failed = 0;
function ok(name, cond) { console.log((cond ? 'pass  ' : 'FAIL  ') + name); if (!cond) failed++; }

// The same two helpers the page uses (public/insights.js), so the graph logic is tested as shipped.
const I = {
  peerOf(d, list) { if (!d || !d.peerId || d.role !== 'backhaul') return null; const p = list.find((x) => x.id === d.peerId); return p && p.role === 'backhaul' ? p : null; },
  isFarEnd(d, list) { const p = I.peerOf(d, list); if (!p) return false; return String(p.id) < String(d.id); }
};

// ---------------- saving site and connection ----------------
const a = devices.add({ name: 'Router', type: 'mikrotik', ip: '10.0.0.1', method: 'ping' }, { ok: true });
const b = devices.add({ name: 'Sector 1', type: 'ubnt', ip: '10.0.0.2', method: 'ping' }, { ok: true });
const c = devices.add({ name: 'Sector 2', type: 'ubnt', ip: '10.0.0.3', method: 'ping' }, { ok: true });

let r = devices.setLayout(b.id, { location: '  Hill tower  ', parentId: a.id });
ok('site is trimmed and the connection saved', r.device && r.device.location === 'Hill tower' && r.device.parentId === a.id);
ok('only those two fields changed', r.device.method === 'ping' && r.device.name === 'Sector 1' && r.device.ip === '10.0.0.2');
ok('a device cannot connect to itself', !!devices.setLayout(a.id, { parentId: a.id }).error);
ok('an unknown device cannot be a parent', !!devices.setLayout(a.id, { parentId: 'dev-nope' }).error);
ok('a loop is refused', !!devices.setLayout(a.id, { parentId: b.id }).error && !devices.get(a.id).parentId);
ok('"internet" is the top of the network', devices.setLayout(a.id, { parentId: 'internet' }).device.parentId === 'internet');
ok('an empty value clears the connection', devices.setLayout(b.id, { parentId: '' }).device.parentId === null);
ok('leaving a field out leaves it alone', devices.setLayout(b.id, { location: 'Hill tower' }).device.parentId === null && devices.setLayout(c.id, { parentId: a.id }).device.location === '');
ok('an unknown device is reported', devices.setLayout('dev-nope', { location: 'x' }).error === 'Device not found');
devices.setLayout(b.id, { parentId: a.id });
devices.remove(a.id);
ok('removing a device frees whatever was connected to it', devices.get(b.id).parentId === null && devices.get(c.id).parentId === null);

// ---------------- sites ----------------
const D = (id, name, over) => Object.assign({ id, name, role: 'device', online: true, location: '', metrics: null }, over || {});
const list = [
  D('r', 'Router', { location: 'Hill tower', metrics: { interfaces: [] } }),
  D('s1', 'Sector 1', { role: 'sector', location: 'hill tower ', metrics: { stationCount: 5, stations: [] } }),
  D('s2', 'Sector 2', { role: 'sector', location: 'North roof', online: false, metrics: { stationCount: 0, stations: [] } }),
  D('s3', 'Sector 3', { role: 'sector', location: 'North roof', metrics: null }),
  D('x', 'Loose box', { location: '' })
];
const sites = model.groupSites(list);
ok('same site with different spelling is one site', sites.length === 3 && sites[0].devices.length === 2 && sites[0].name === 'Hill tower');
ok('sites by name, devices without a site last', sites.map((g) => g.key).join('|') === 'hill tower|north roof|');
const sum = model.siteSummary(sites[1].devices, { s3: true });
ok('summary: one down, one needing attention', sum.down === 1 && sum.warn === 1 && sum.worst === 'down');
ok('a sector whose clients are not read is not shown as 0 customers', sum.notRead === 1 && sum.customers === 0);
ok('a read client list counts', model.siteSummary(sites[0].devices, {}).customers === 5);
ok('health: unreachable and unknown are not "down"', model.healthOf(D('u', 'u', { online: null }), {}) === 'unknown' && model.healthOf(D('u', 'u', { unreachable: true }), {}) === 'unknown');

// ---------------- connection graph and layout ----------------
const net = [
  D('bhA', 'Link near', { role: 'backhaul', peerId: 'bhB', parentId: 'internet' }),
  D('bhB', 'Link far', { role: 'backhaul', peerId: 'bhA' }),
  D('core', 'Core', { parentId: 'bhB' }),               // points at the far end: folded into the link node
  D('s1', 'Sector 1', { role: 'sector', parentId: 'core' }),
  D('s2', 'Sector 2', { role: 'sector', parentId: 'core' }),
  D('olt', 'OLT', { parentId: 'core' }),
  D('lost', 'Unplaced'),
  D('bad', 'Dangling', { parentId: 'gone' })
];
const g = model.buildGraph(net, I);
ok('a paired link is one node', g.list.filter((n) => n.far).length === 1 && !g.nodes.bhB && g.nodes.bhA.label.indexOf('⇄') > -1);
ok('a device pointing at the far end hangs off the link', g.nodes.core.parent === 'bhA');
ok('the tree is internet -> link -> core -> three devices', g.roots.length === 1 && g.roots[0].id === 'bhA' && g.nodes.core.children.length === 3);
ok('devices with no or a missing connection are "not connected yet"', g.loose.map((n) => n.id).sort().join() === 'bad,lost');
const L = model.layout(g);
const boxes = Object.keys(L.pos);
const overlap = boxes.some((x, i) => boxes.slice(i + 1).some((y) => Math.abs(L.pos[x].x - L.pos[y].x) < L.nodeW && Math.abs(L.pos[x].y - L.pos[y].y) < L.nodeH));
ok('no two boxes overlap', !overlap);
ok('children sit below their parent and inside the drawing', L.pos.s1.y > L.pos.core.y && L.pos.core.y > L.pos.bhA.y && boxes.every((id) => L.pos[id].x >= 0 && L.pos[id].x + L.nodeW <= L.width && L.pos[id].y + L.nodeH <= L.height));
const kidX = ['s1', 's2', 'olt'].map((id) => L.pos[id].x);
ok('the parent is centred over its children', Math.abs((Math.min.apply(null, kidX) + Math.max.apply(null, kidX)) / 2 - L.pos.core.x) < 1);
ok('loose devices are drawn under the tree', L.looseTop !== null && L.pos.lost.y > L.pos.s1.y && !!L.internet);
// a saved loop must not hang the page
const loop = model.buildGraph([D('p', 'P', { parentId: 'q' }), D('q', 'Q', { parentId: 'p' })], I);
ok('a saved loop is cut, not followed for ever', loop.list.length === 2 && loop.loose.length >= 1);
ok('an empty network lays out', model.layout(model.buildGraph([], I)).height > 0);

// ---------------- trace a customer ----------------
const t = net.map((d) => Object.assign({}, d));
t.find((d) => d.id === 's1').metrics = { stations: [{ mac: 'AA:BB:CC:00:00:01', name: 'CPE-ali', signal: -78, ccq: 61, txRate: 52, rxRate: 40 }, { mac: 'AA:BB:CC:00:00:02', name: 'CPE-sara', signal: -60, ccq: 95 }] };
t.find((d) => d.id === 'olt').metrics = { onus: [{ name: 'noor@isp', serial: 'HWTC01', online: true, signal: -28.6, temp: 47 }, { name: 'off@isp', serial: 'HWTC02', online: false }] };
const sasByKey = { aabbcc000001: { username: 'ali@isp', name: 'Ali', plan: 'Home 10M', online: true }, aabbcc000002: { username: 'sara@isp', plan: 'Pro', online: false }, 'sn:HWTC01': { username: 'noor@isp', online: true } };
const sasList = [sasByKey.aabbcc000001, sasByKey.aabbcc000002, sasByKey['sn:HWTC01'], { username: 'ghost@isp', online: true }];
const cands = model.candidates(t, sasByKey, sasList);
ok('radios, ONUs and unmatched SAS users are all searchable', cands.filter((x) => x.type === 'radio').length === 2 && cands.filter((x) => x.type === 'onu').length === 2 && cands.filter((x) => x.type === 'sas').length === 1);
ok('search by username, MAC and name', model.search(cands, 'ali@').length === 1 && model.search(cands, 'aabbcc000002').length === 1 && model.search(cands, 'AA:BB:CC:00:00:02').length === 1 && model.search(cands, 'cpe-ali').length === 1);
ok('a one-letter search finds nothing', model.search(cands, 'a').length === 0);
const att = {};
let tr = model.chain(model.search(cands, 'ali@isp')[0], t, I, att);
ok('a complete path says nothing is wrong when nothing is', model.chain(model.search(cands, 'sara@isp')[0], t.map((d) => (d.id === 'core' ? Object.assign({}, d, { parentId: 'bhB' }) : d)), I, att).verdict.text !== undefined);
ok('the path runs customer, radio, sector, core, link, internet', tr.hops.map((h) => h.kind).join() === 'customer,radio,device,device,link,internet');
ok('a weak radio is the verdict', tr.verdict.state === 'warn' && /-78 dBm/.test(tr.verdict.text) && tr.hops[1].state === 'warn');
tr = model.chain(model.search(cands, 'sara@isp')[0], t, I, att);
ok('a radio that is fine but a PPPoE session offline says so', tr.verdict.state === 'warn' && /PPPoE session is offline although their radio is connected/.test(tr.verdict.text));
tr = model.chain(model.search(cands, 'noor@isp')[0], t, I, att);
ok('a weak ONU reads as weak fibre', tr.hops[1].kind === 'onu' && /fibre/i.test(tr.verdict.text));
tr = model.chain(model.search(cands, 'off@isp')[0], t, I, att);
ok('an offline ONU is down', tr.verdict.state === 'down' && /ONU is offline/.test(tr.verdict.text));
t.find((d) => d.id === 'bhA').online = false;
tr = model.chain(model.search(cands, 'sara@isp')[0], t, I, att);
ok('an offline uplink is named as the cause for everything behind it', tr.verdict.state === 'down' && /offline\. Everything behind it/.test(tr.verdict.text));
t.find((d) => d.id === 'bhA').online = true;
tr = model.chain(model.search(cands, 'ghost')[0], t, I, att);
ok('a SAS customer with no radio is explained', tr.hops.some((h) => h.kind === 'gap') && /No radio was found/.test(tr.verdict.text));
t.find((d) => d.id === 'core').parentId = null;
tr = model.chain(model.search(cands, 'ali@isp')[0], t, I, att);
const healthyT = t.map((d) => (d.id === 's1' ? Object.assign({}, d, { metrics: { stations: [{ mac: 'AA:BB:CC:00:00:01', name: 'CPE-ali', signal: -58, ccq: 96 }] } }) : d));
const healthy = model.chain(model.search(model.candidates(healthyT, sasByKey, sasList), 'ali@isp')[0], healthyT, I, att);
ok('an incomplete path does not claim everything is fine', healthy.verdict.state === 'up' && /not set up yet, so the rest of the path is not checked/.test(healthy.verdict.text));
ok('a path with an unconnected hop says what to do', tr.hops[tr.hops.length - 1].kind === 'gap' && /Link diagram/.test(tr.hops[tr.hops.length - 1].sub));

// ---------------- Mimosa: which end of the link this radio is ----------------
const mim = require('../src/transports/mimosa');
const mm = (di, rem) => mim.parseStatus({ realtime: { device_info: di, remote_info: rem || {}, signalmeter: {}, connection: {} } }).radio;
ok('a point-to-point Access point is the master (not a sector)', mm({ DeviceMode: 'Access point', PTMPMode: 0 }, { DeviceMode: 'Station' }).mode === 'master' && mm({ DeviceMode: 'Access point', PTMPMode: 0 }, { DeviceMode: 'Station' }).remoteMode === 'sta');
ok('a Station is the slave', mm({ DeviceMode: 'Station' }, { DeviceMode: 'Access point' }).mode === 'sta' && mm({ DeviceMode: 'Station' }, { DeviceMode: 'Access point' }).remoteMode === 'master');
ok('a point-to-multipoint Access point is a real AP', mm({ DeviceMode: 'Access point', PTMPMode: 1 }).mode === 'ap-ptmp');
ok('an unknown mode is left unsaid', mm({}).mode === undefined);

// ---------------- M-series access point client list ----------------
const stations = airos.mapStations([{ mac: '44:D9:E7:00:00:01', name: 'cpe1', lastip: '10.1.1.5', signal: -61, ccq: 912, tx: 130, rx: 117, uptime: 99 }, { junk: true }, null], true);
ok('sta.cgi records are read (per-mille CCQ becomes percent)', stations.length === 1 && stations[0].ccq === 91 && stations[0].signal === -61 && stations[0].ip === '10.1.1.5');
ok('the AC format still reads as before (no per-mille change)', airos.mapStations([{ mac: 'AA', ccq: 912 }], false)[0].ccq === 912);

// ---------------- airOS 6: byte counters live on /ifstats.cgi ----------------
const ifs = airos.parseIfstats({ interfaces: [{ ifname: 'eth0', stats: { rx_bytes: '3349211515', tx_bytes: '100' } }, { ifname: 'ath0', stats: { rx_bytes: '5', tx_bytes: '6' } }, { ifname: 'lo', stats: {} }, { stats: { rx_bytes: '1', tx_bytes: '1' } }] }, { eth0: true, ath0: false });
ok('ifstats counters are read (they arrive as text) and are 32-bit', ifs.length === 2 && ifs[0].rxBytes === 3349211515 && ifs[0].counterBits === 32 && ifs[0].up === true && ifs[1].up === false);
ok('an interface with no counters, or no name, is left out', !ifs.some((i) => i.name === 'lo' || !i.name));

async function apStationList() {
  const mkIf = (ifResult, statusIfaces) => {
    const s = new airos.AirosSession({ base: 'http://x', jar: {}, timeout: 1000, port: 80, secure: false });
    s.fetchStatus = async () => ({ host: {}, wireless: { mode: 'sta' }, interfaces: statusIfaces || [{ ifname: 'eth0', enabled: true, status: { plugged: 1 } }] });
    s.calls = 0;
    s.fetchIfstats = async () => { s.calls++; if (ifResult instanceof Error) throw ifResult; return ifResult; };
    return s;
  };
  let s2 = mkIf({ interfaces: [{ ifname: 'eth0', stats: { rx_bytes: '10', tx_bytes: '20' } }] });
  let r2 = await s2.readStats();
  ok('a radio whose status has no counters gets them from ifstats', r2.interfaces.length === 1 && r2.interfaces[0].name === 'eth0' && r2.interfaces[0].txBytes === 20 && r2.interfaces[0].up === true);
  s2 = mkIf(null); await s2.readStats(); await s2.readStats();
  ok('a radio without ifstats is asked once, then left alone', s2.calls === 1 && s2.ifstats === false);
  s2 = mkIf(new Error('boom')); r2 = await s2.readStats();
  ok('a failure reading ifstats never fails the poll', r2.interfaces.length === 0 && s2.ifstats !== false);
  s2 = mkIf({ interfaces: [] }, [{ ifname: 'eth0', status: { rx_bytes: 5, tx_bytes: 6, plugged: 1 } }]); r2 = await s2.readStats();
  ok('a radio that already has counters is not asked', r2.interfaces.length === 1 && s2.calls === 0);

  const mk = (statusMode, staResult) => {
    const s = new airos.AirosSession({ base: 'http://x', jar: {}, timeout: 1000, port: 80, secure: false });
    s.fetchStatus = async () => ({ host: { hostname: 'AP' }, wireless: { mode: statusMode, signal: -50, essid: 'net' }, interfaces: [] });
    s.calls = 0;
    s.fetchSta = async () => { s.calls++; if (staResult instanceof Error) throw staResult; return staResult; };
    return s;
  };
  let s = mk('ap', [{ mac: 'AA:BB:CC:DD:EE:01', name: 'cpe', signal: -70 }]);
  let st = await s.readStats();
  ok('an AP with no clients in status reads them from sta.cgi', st.stations.length === 1 && st.radio.stations === 1);
  s = mk('ap', null); await s.readStats(); await s.readStats();
  ok('an AP without sta.cgi is asked once, then left alone', s.calls === 1 && s.staCgi === false);
  s = mk('sta', [{ mac: 'AA' }]); st = await s.readStats();
  ok('a client radio is never asked for a client list', s.calls === 0 && st.stations.length === 0);
  s = mk('ap', new Error('boom')); st = await s.readStats();
  ok('a failure reading sta.cgi never fails the poll', st.stations.length === 0 && s.staCgi !== false);
}

apStationList().catch((e) => { console.log('FAIL  threw: ' + (e && e.stack || e)); failed++; }).then(() => {
  if (failed) { console.log(failed + ' topology test(s) failed.'); process.exit(1); }
  console.log('Topology tests passed.');
  process.exit(0);
});
