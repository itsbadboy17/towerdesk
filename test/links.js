// Tests link pairing (both ends managed vs slave only), the saved pairing on devices, and that
// the demo sector registration table carries MACs that match the demo SAS sessions.
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-links-'));
process.env.TOWERDESK_DATA_DIR = tmp;
process.env.TOWERDESK_HISTORY = 'off';

const { pairLinks } = require('../src/links');
const devices = require('../src/devices');
const demo = require('../src/demo');
const subscribers = require('../src/subscribers');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}
const bh = (id, name, radio, peerId) => ({ id, name, role: 'backhaul', peerId: peerId || null, metrics: { radio: radio || {} } });

// Explicit pairing is kept only when it is mutual and the peer exists.
let l = pairLinks([bh('a', 'A', {}, 'b'), bh('b', 'B', {}, 'a')]);
ok('explicit mutual pair kept', l[0].peerId === 'b' && l[1].peerId === 'a' && !l[0].peerAuto);
l = pairLinks([bh('a', 'A', {}, 'gone')]);
ok('pair to missing device dropped', l[0].peerId === null);
l = pairLinks([bh('a', 'A', {}, 'b'), bh('b', 'B', {})]);
ok('one-sided pair dropped', l[0].peerId === null && l[1].peerId === null);

// Auto pairing: same link name, or one end names the other as its remote.
l = pairLinks([bh('a', 'Tower', { linkName: 'North-Link' }), bh('b', 'Core', { linkName: 'north-link' })]);
ok('auto pair by link name', l[0].peerId === 'b' && l[1].peerId === 'a' && l[0].peerAuto === true);
l = pairLinks([bh('a', 'Tower', { remoteName: 'Core POP' }), bh('b', 'core pop', {})]);
ok('auto pair by remote name', l[0].peerId === 'b' && l[1].peerId === 'a');

// Slave only: nothing to pair with, and non-links are never paired.
l = pairLinks([bh('a', 'Tower', { linkName: 'x', remoteName: 'Far' }), { id: 's', name: 'Far', role: 'sector', metrics: { radio: { linkName: 'x' } } }]);
ok('slave-only link stays unpaired', l[0].peerId === null && !l[1].peerId);
l = pairLinks([bh('a', 'A', { linkName: 'x' }), bh('b', 'B', { linkName: 'x' }), bh('c', 'C', { linkName: 'x' })]);
ok('a device has at most one peer', l[0].peerId === 'b' && l[2].peerId === null);

// Saved pairing: stored on both ends, re-pairing clears the old peer, removal unpairs.
const mk = (name, ip) => devices.add({ name, type: 'ubnt', ip, method: 'ping' }).id;
const A = mk('A', '10.0.0.1'), B = mk('B', '10.0.0.2'), C = mk('C', '10.0.0.3');
devices.edit(A, { peerId: B });
ok('pair saved on both ends', devices.get(A).peerId === B && devices.get(B).peerId === A);
devices.edit(A, { peerId: C });
ok('re-pair clears old peer', devices.get(A).peerId === C && devices.get(C).peerId === A && !devices.get(B).peerId);
devices.edit(A, { peerId: A });
ok('cannot pair with itself', devices.get(A).peerId === C);
devices.edit(A, { peerId: 'nope' });
ok('unknown peer ignored', devices.get(A).peerId === C);
devices.edit(A, { location: 'Roof' });
ok('edit without peerId keeps pair', devices.get(A).peerId === C);
devices.remove(C);
ok('removing a device unpairs its peer', !devices.get(A).peerId);
devices.edit(A, { peerId: B }); devices.edit(A, { peerId: '' });
ok('empty peerId unpairs both', !devices.get(A).peerId && !devices.get(B).peerId);

// Demo: one link with both ends, one with the slave only.
const snap = demo.snapshot();
const by = (id) => snap.devices.find((d) => d.id === id);
ok('demo East backhaul has both ends', by('bh2').peerId === 'bh2m' && by('bh2m').peerId === 'bh2');
ok('demo North backhaul is slave only', by('bh1').peerId === null);

// Demo sector registration: every station has a MAC, and all but the spare match a SAS session.
const norm = (m) => String(m).toLowerCase().replace(/[^0-9a-f]/g, '');
const sasMacs = new Set(subscribers._demoSubs(24).map((s) => norm(s.mac)));
const st = by('s1').metrics.stations;
ok('demo sector lists stations with MACs', st.length > 1 && st.every((x) => norm(x.mac).length === 12));
ok('demo station MACs match SAS', st.filter((x) => sasMacs.has(norm(x.mac))).length === st.length - 1);
ok('demo offline sector has no stations', by('s3').metrics.stations.length === 0);

// ---- Subscriber lookup: trace SAS sessions to sector stations by MAC ----
const lookup = require('../src/lookup');
const sec = (id, name, macs) => ({ id, name, metrics: { stations: macs.map((m, i) => ({ name: 'cpe' + i, mac: m, signal: -60 - i, ccq: 90 })) } });
let subs = [{ username: 'a', mac: 'aa-bb-cc-00-00-01' }, { username: 'b', mac: 'AA:BB:CC:00:00:09' }, { username: 'c', mac: null }];
let r = lookup.attachStations(subs, [sec('s1', 'North', ['AA:BB:CC:00:00:01']), sec('s2', 'West', ['AA:BB:CC:00:00:50'])]);
ok('exact match ignores MAC formatting', subs[0].station && subs[0].station.sectorName === 'North' && subs[0].station.signal === -60 && subs[0].station.near === false);
ok('no match leaves station null', subs[1].station === null && subs[2].station === null && r.matched === 1);

// One step off (PPPoE dialled on another port of the CPE) matches when unambiguous, flagged near.
subs = [{ username: 'a', mac: 'AA:BB:CC:00:00:11' }];
r = lookup.attachStations(subs, [sec('s1', 'North', ['AA:BB:CC:00:00:10'])]);
ok('near match one step off', subs[0].station && subs[0].station.near === true && r.near === 1);
// Ambiguous: two subscribers both one step from the same station -> no guess.
subs = [{ username: 'a', mac: 'AA:BB:CC:00:00:11' }, { username: 'b', mac: 'AA:BB:CC:00:00:0F' }];
lookup.attachStations(subs, [sec('s1', 'North', ['AA:BB:CC:00:00:10'])]);
ok('ambiguous near match refused', subs[0].station === null && subs[1].station === null);
// Consecutive CPE MACs: exact matches win, nothing is stolen by a neighbour.
subs = [{ username: 'a', mac: 'AA:BB:CC:00:00:10' }, { username: 'b', mac: 'AA:BB:CC:00:00:11' }];
lookup.attachStations(subs, [sec('s1', 'North', ['AA:BB:CC:00:00:11', 'AA:BB:CC:00:00:10'])]);
ok('consecutive MACs match exactly', subs[0].station.mac === 'AA:BB:CC:00:00:10' && subs[1].station.mac === 'AA:BB:CC:00:00:11' && !subs[0].station.near);
ok('two steps off is not a match', lookup.isNear('aabbcc000010', 'aabbcc000012') === false);

// Demo: online subscribers on the live sectors are traced to their radio.
const demoSubs = subscribers._demoSubs(24);
const dr = lookup.attachStations(demoSubs, snap.devices);
const north = demoSubs.filter((s) => s.nas === 'Sector North' && s.online);
ok('demo subscribers traced to their sector', north.length > 0 && north.every((s) => s.station && s.station.sectorName === 'Sector North') && dr.near === 0);
ok('demo offline subscribers have no station', demoSubs.filter((s) => !s.online).every((s) => s.station === null));

// ---- MikroTik registration table parsing (legacy wireless and the newer wifi package) ----
const { parseRegistration } = require('../src/transports/mikrotik');
const legacy = parseRegistration([{ interface: 'wlan1', 'radio-name': 'CPE-1', 'mac-address': '4C:5E:0C:00:00:01', 'last-ip': '10.0.0.5', 'signal-strength': '-58dBm@HT20-7', 'tx-ccq': '97', 'tx-rate': '144.4Mbps-20MHz/2S/SGI', 'rx-rate': '130Mbps-20MHz/2S', bytes: '1000,200' }])[0];
ok('legacy registration row', legacy.signal === -58 && legacy.ccq === 97 && legacy.txRate === 144.4 && legacy.rxRate === 130 && legacy.txBytes === 1000 && legacy.rxBytes === 200 && legacy.name === 'CPE-1');
const wifi = parseRegistration([{ interface: 'wifi1', 'mac-address': '4C:5E:0C:00:00:02', signal: '-63', 'tx-rate': '286800000', 'rx-rate': '258000000', bytes: '5,6' }, { interface: 'wifi1' }]);
ok('wifi registration row', wifi.length === 1 && wifi[0].signal === -63 && wifi[0].txRate === 286.8 && wifi[0].rxRate === 258 && wifi[0].ccq === undefined && wifi[0].name === '4C:5E:0C:00:00:02');

// ---- False "disconnected" alerts: one missed check, or the whole network being unreachable ----
const alerts = require('../src/alerts');
const dev = { id: 'dv1', name: 'Sector', ip: '10.1.1.1' };
const openCount = () => alerts.summary().active;
alerts.evaluate(dev, { online: false, downStreak: 1 });
alerts.evaluate(dev, { online: false, downStreak: 2 });
ok('no alert for a brief drop', openCount() === 0);
alerts.evaluate(dev, { online: false, downStreak: alerts.OFFLINE_CONFIRM });
ok('alert after repeated failed checks', openCount() === 1);
alerts.networkUnreachable(dev.id);
ok('network unreachable closes device alerts', openCount() === 0);
ok('a cleared offline alert leaves no history', !alerts.list().some((a) => a.kind === 'offline'));
alerts.evaluate(dev, { online: false, downStreak: alerts.OFFLINE_CONFIRM });
alerts.evaluate(dev, { online: true, recentLatencies: [10, 10, 10] });
ok('coming back removes the offline alert instead of filing it', openCount() === 0 && !alerts.list().some((a) => a.kind === 'offline'));
alerts.evaluate(dev, { online: true, recentLatencies: [400, 400, 400] });
alerts.evaluate(dev, { online: true, recentLatencies: [10, 10, 10] });
ok('a cleared latency alert stays in the history', alerts.list().some((a) => a.kind === 'latency' && a.resolvedAt));

(async () => {
  // Every device unreachable at once (192.0.2.x never answers) = the path to the tower is down:
  // statuses become unknown, one network event is logged, and no per-device alert is raised.
  devices.list().forEach((d) => devices.remove(d.id));
  devices.add({ name: 'T1', type: 'other', ip: '192.0.2.1', method: 'ping' });
  devices.add({ name: 'T2', type: 'other', ip: '192.0.2.2', method: 'ping' });
  const monitor = require('../src/monitor');
  ok('not checked yet shows unknown, not offline', monitor.snapshot().devices.every((d) => d.online === null));
  for (let i = 0; i < alerts.OFFLINE_CONFIRM + 1; i++) await monitor.tick();
  const ms = monitor.snapshot();
  ok('all unreachable flags the network', ms.networkDown === true && ms.unreachableNetworks.join() === '192.0.2.x');
  ok('devices are unknown, not offline', ms.devices.every((d) => d.online === null && d.unreachable === true) && ms.summary.offline === 0);
  ok('one network event, no device events', ms.events.length === 1 && ms.events[0].id === 'network' && ms.events[0].online === false);
  ok('no alerts while the network is down', openCount() === 0);

  // A device on another network that still answers (like the home router) does not hide it,
  // and a lone unreachable device on its own network is a normal offline.
  devices.add({ name: 'Local', type: 'other', ip: '127.0.0.1', method: 'ping' });
  devices.add({ name: 'Lone', type: 'other', ip: '198.51.100.9', method: 'ping' });
  for (let i = 0; i < alerts.OFFLINE_CONFIRM; i++) await monitor.tick();
  const m2 = monitor.snapshot();
  const dn = (name) => m2.devices.find((d) => d.name === name);
  ok('network still flagged with a local device online', m2.networkDown === true && dn('Local').online === true && dn('Local').unreachable === false);
  ok('tower devices stay unknown', dn('T1').online === null && dn('T2').online === null);
  ok('lone unreachable device is a normal offline with an alert', dn('Lone').online === false && dn('Lone').unreachable === false && openCount() === 1);

  // Recent changes: setup and customer changes, never online/offline flips.
  monitor.note('setting', 'dvx', 'Sector', 'Sector: Frequency 5180 → 5240 MHz (applied, waiting to be kept)');
  const added = devices.add({ name: 'Brand new', type: 'other', ip: '192.0.2.77', method: 'ping' });
  await monitor.tick();
  const ch = monitor.snapshot().changes;
  ok('a note appears in the changes feed', ch.some((c) => c.kind === 'setting' && /5240/.test(c.text)));
  ok('a device added later is a change', ch.some((c) => c.kind === 'device' && /Brand new was added/.test(c.text)));
  devices.remove(added.id);
  await monitor.tick();
  ok('a device removed is a change', monitor.snapshot().changes.some((c) => /Brand new was removed/.test(c.text)));
  ok('online/offline flips are not in the changes feed', monitor.snapshot().changes.every((c) => !/online|offline|went/i.test(c.text.replace(/waiting to be kept/, ''))));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Link pairing tests passed.');
  process.exit(0);
})();
