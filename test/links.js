// Tests link pairing (both ends managed vs slave only), the saved pairing on devices, and that
// the demo sector registration table carries MACs that match the demo SAS sessions.
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-links-'));
process.env.TOWERDESK_DATA_DIR = tmp;

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

fs.rmSync(tmp, { recursive: true, force: true });
console.log('Link pairing tests passed.');
