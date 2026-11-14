// Neighbour discovery: turning raw neighbour tables into "who is next to whom" and suggestions.
// The fixture has the same shape as a real MikroTik on a tower: the gateway is on its radio port, the
// switch and the other radios are on its cable port.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-neighbors-' + process.pid);
const assert = require('assert');
const N = require('../src/neighbors');

let fails = 0;
function check(name, fn) { try { fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

const devices = [
  { id: 'gw', name: 'Gateway', ip: '10.0.0.1', type: 'other' },
  { id: 'sm18', name: 'Sm18', ip: '10.0.0.18', type: 'mikrotik' },
  { id: 's21', name: 's21', ip: '10.0.0.21', type: 'mikrotik' },
  { id: 'su10', name: 'Su10', ip: '10.0.0.10', type: 'ubnt', parentId: null }
];
const raw = {
  mndp: [
    { ip: '0.0.0.0', mac: Buffer.from('001d463d9f8c', 'hex'), platform: 'cisco WS-C2960-24TT-L', identity: 'Switch', ifIndex: 2 },
    { ip: '10.0.0.21', mac: Buffer.from('744d285fadc4', 'hex'), platform: 'MikroTik', identity: 'HRINS-Sm21', ifIndex: 2 },
    { ip: '10.0.0.22', mac: Buffer.from('4c5e0c8a1f88', 'hex'), platform: 'MikroTik', identity: 'HRINS SM22', ifIndex: 2 }
  ],
  // LLDP gives the chassis id as TEXT on this device
  lldp: [{ local: '2', chassis: Buffer.from('00:1D:46:3D:9F:8C'), portId: 'FastEthernet0/12', sysName: 'Switch' }],
  cdp: [],
  arp: [{ ip: '10.0.0.1', mac: '70:69:5a:2b:bd:c0' }],
  gateway: '10.0.0.1',
  fdb: [
    { mac: '70:69:5a:2b:bd:c0', port: 'wlan1' },
    { mac: 'aa:bb:cc:00:00:10', port: 'ether1' },   // Su10 (its own MAC comes from the monitor)
    { mac: '74:4d:28:5f:ad:c4', port: 'wlan1' }     // s21 again, under the wrong port: the neighbour table wins
  ],
  ifNames: { 2: 'ether1' },
  selfMacs: ['08:00:00:00:00:18']
};
const parsed = N.fromSnmpTables(Object.assign({}, raw, { mndp: raw.mndp.map((r) => Object.assign({}, r)) }));
const obs = [Object.assign({ deviceId: 'sm18' }, parsed)];
const A = N.analyse(devices, obs, { su10: ['aa:bb:cc:00:00:10'] });

check('a MAC written as text is read like raw bytes', () => assert.strictEqual(N.normMac(Buffer.from('00:1D:46:3D:9F:8C')), '00:1d:46:3d:9f:8c'));
check('MAC formats are all read the same way', () => { assert.strictEqual(N.normMac('0011.2233.4455'), '00:11:22:33:44:55'); assert.strictEqual(N.normMac('00-11-22-33-44-55'), '00:11:22:33:44:55'); assert.strictEqual(N.normMac('nope'), ''); });
check('0.0.0.0 is not an address', () => assert.strictEqual(N.normIp('0.0.0.0'), ''));
check('LLDP and MNDP sightings of the same box become one row', () => assert.strictEqual(parsed.rows.filter((r) => r.mac === '00:1d:46:3d:9f:8c').length, 1));
check('the merged row keeps the port both sides reported', () => { const r = parsed.rows.find((x) => x.mac === '00:1d:46:3d:9f:8c'); assert.strictEqual(r.localPort, 'ether1'); assert.strictEqual(r.remotePort, 'FastEthernet0/12'); assert.strictEqual(r.platform, 'cisco WS-C2960-24TT-L'); });
check('the default gateway is read', () => assert.strictEqual(A.gateway, '10.0.0.1'));
check('the gateway device is suggested to plug into the internet', () => { assert.strictEqual(A.suggestions.gw.parentId, 'internet'); assert.strictEqual(A.gatewayId, 'gw'); });
check('a device between the gateway and the rest gets its internet from the gateway', () => assert.strictEqual(A.suggestions.sm18.parentId, 'gw'));
check('a Cisco switch that is not added is listed, with a type to preselect', () => { const u = A.unknown.find((x) => x.kind === 'switch'); assert.ok(u); assert.strictEqual(u.typeHint, 'cisco'); assert.strictEqual(u.mac, '00:1d:46:3d:9f:8c'); });
check('radios on the cable side are suggested to plug into that switch (named, not yet added)', () => { assert.strictEqual(A.suggestions.s21.parentId, null); assert.strictEqual(A.suggestions.s21.parentName, 'Switch'); assert.ok(A.suggestions.s21.needsAdding); });
check('a radio found only in the MAC table joins the same wire', () => { assert.ok(A.suggestions.su10, 'su10 has a suggestion'); assert.strictEqual(A.suggestions.su10.parentName, 'Switch'); });
check('a neighbour table beats the MAC table for the same device', () => assert.ok(!(A.nearby.s21 || []).some((n) => n.port === 'wlan1')));
check('the neighbours of a sector include the other sectors on its wire', () => { const names = A.nearby.s21.map((n) => n.name); assert.ok(names.includes('HRINS SM22')); assert.ok(names.includes('Sm18')); });
check('the one that told us about it is listed as a direct neighbour', () => assert.strictEqual(A.nearby.s21.find((n) => n.name === 'Sm18').kind, 'direct'));
check('devices seen but not added are listed once each', () => { assert.strictEqual(A.unknown.filter((x) => x.ip === '10.0.0.22').length, 1); });
check('a device already set up the way the neighbours show is marked as such', () => {
  const B = N.analyse(devices.map((d) => (d.id === 'sm18' ? Object.assign({}, d, { parentId: 'gw' }) : d)), obs, {});
  assert.strictEqual(B.suggestions.sm18.already, true);
});
check('applying every suggestion never makes a loop', () => {
  // the owner had it backwards (gateway below Sm18); the suggestions turn it around, in one piece
  const B = N.analyse(devices.map((d) => (d.id === 'gw' ? Object.assign({}, d, { parentId: 'sm18' }) : d)), obs, {});
  const parent = {};
  devices.forEach((d) => { parent[d.id] = d.id === 'gw' ? 'sm18' : null; });
  Object.keys(B.suggestions).forEach((id) => { if (B.suggestions[id].parentId) parent[id] = B.suggestions[id].parentId; });
  Object.keys(parent).forEach((id) => { let cur = id, n = 0; while (cur && cur !== 'internet') { assert.ok(n++ < 10, 'loop at ' + id); cur = parent[cur]; } });
});
check('a suggestion pointing at one of its own children is dropped', () => {
  // no gateway known, so nothing turns the owner\'s (reversed) layout around: do not make it worse
  const onlySwitchSide = [Object.assign({ deviceId: 'sm18' }, N.fromSnmpTables({ mndp: [{ ip: '10.0.0.21', mac: Buffer.from('744d285fadc4', 'hex'), platform: 'cisco', identity: 'Switch', ifIndex: 2 }], ifNames: { 2: 'ether1' } }))];
  const B = N.analyse(devices.map((d) => (d.id === 'sm18' ? Object.assign({}, d, { parentId: 's21' }) : d)), onlySwitchSide, {});
  assert.ok(!B.suggestions.s21 || B.suggestions.s21.parentId !== 'sm18');
});
check('MikroTik API rows are read like SNMP rows', () => {
  const m = N.fromMikrotikTables({ neighbors: [{ identity: 'Sw1', platform: 'Cisco', 'mac-address': '00:1D:46:3D:9F:8C', address: '', interface: 'ether2' }], arp: [{ address: '10.0.0.1', 'mac-address': '70:69:5A:2B:BD:C0' }], hosts: [{ 'mac-address': '70:69:5A:2B:BD:C0', 'on-interface': 'ether1' }], gateway: '10.0.0.1', selfMacs: ['08:00:00:00:00:01'] });
  assert.strictEqual(m.rows[0].localPort, 'ether2'); assert.strictEqual(m.gateway, '10.0.0.1'); assert.strictEqual(m.fdb[0].port, 'ether1'); assert.strictEqual(m.selfMacs[0], '08:00:00:00:00:01');
});
check('a switch port summary counts the devices behind each port and lists what is plugged in', () => {
  const parsed = N.fromSnmpTables({
    mndp: [{ ip: '10.0.0.21', mac: Buffer.from('744d285fadc4', 'hex'), platform: 'MikroTik', identity: 'HRINS-Sm21', ifIndex: 3 }],
    lldp: [], cdp: [{ ifIndex: '3', addr: '10.0.0.5', deviceId: 'core-sw', port: 'Gi0/1', platform: 'cisco WS-C2960' }],
    ifNames: { 3: 'Gi0/3' }, fdb: [{ mac: Buffer.from('aabbcc000001', 'hex'), port: 'Gi0/3' }, { mac: Buffer.from('aabbcc000002', 'hex'), port: 'Gi0/3' }, { mac: Buffer.from('aabbcc000003', 'hex'), port: 'Gi0/9' }]
  });
  const pm = N.portMeta(parsed);
  assert.strictEqual(pm['Gi0/3'].macCount, 2); assert.strictEqual(pm['Gi0/9'].macCount, 1);
  assert.ok(pm['Gi0/3'].neighbors.some((n) => n.name === 'HRINS-Sm21' && n.ip === '10.0.0.21'));
  assert.ok(pm['Gi0/3'].neighbors.some((n) => n.name === 'core-sw' && n.port === 'Gi0/1'));
});
check('a device that moved to a different parent between two scans is reported', () => {
  const before = { su10: { parentId: 'sw', parentName: 'Switch' }, s21: { parentId: 'sw' } };
  const after = { su10: { parentId: 'sm18', parentName: 'Sm18' }, s21: { parentId: 'sw' }, newbie: { parentId: 'sw' } };
  const d = N.diffSuggestions(before, after, (id) => ({ sw: 'Switch', sm18: 'Sm18' }[id]));
  assert.strictEqual(d.length, 1); assert.strictEqual(d[0].id, 'su10'); assert.ok(/now seen next to Sm18 \(before: Switch\)/.test(d[0].text));
});
check('the first scan reports no changes', () => assert.deepStrictEqual(N.diffSuggestions({}, { a: { parentId: 'x' } }, () => 'x'), []));
check('a port summary for a device with no tables is empty', () => assert.deepStrictEqual(N.portMeta(null), {}));
check('a gateway that TowerDesk knows by another address is still found, by its name', () => {
  const devs = [{ id: 'gw', name: 'Gateway', ip: '192.168.229.21', type: 'mikrotik' }, { id: 'sec', name: 'Sector1', ip: '192.168.229.31', type: 'mikrotik' }, { id: 'sw', name: 'Cisco-SW', ip: '192.168.229.24', type: 'switch' }];
  const o = [{ deviceId: 'sec', gateway: '10.10.11.1', arp: [], fdb: [], selfMacs: [], rows: [{ via: 'mndp', mac: '0c:8f:6b:81:00:00', ip: '10.10.11.1', name: 'Gateway', platform: 'MikroTik', remotePort: '', localPort: 'ether1' }, { via: 'mndp', mac: 'aa:bb:cc:00:01:10', ip: '10.10.11.254', name: 'Cisco-SW', platform: 'Linux Unix Cisco IOS Software', remotePort: '', localPort: 'ether1' }] }];
  const r = N.analyse(devs, o, {});
  assert.strictEqual(r.gatewayId, 'gw'); assert.strictEqual(r.suggestions.gw.parentId, 'internet');
});
check('the Switch device type is treated as a switch', () => {
  const devs = [{ id: 'sw', name: 'Cisco-SW', ip: '192.168.229.24', type: 'switch' }, { id: 'a', name: 'A', ip: '192.168.229.31', type: 'mikrotik' }, { id: 'b', name: 'B', ip: '192.168.229.32', type: 'mikrotik' }];
  const o = [{ deviceId: 'a', gateway: '', arp: [], fdb: [], selfMacs: [], rows: [{ via: 'mndp', mac: 'aa:bb:cc:00:01:10', ip: '10.0.0.254', name: 'Cisco-SW', platform: 'Cisco IOS', remotePort: '', localPort: 'ether1' }, { via: 'mndp', mac: '0c:00:00:00:00:02', ip: '10.0.0.12', name: 'B', platform: 'MikroTik', remotePort: '', localPort: 'ether1' }] }];
  const r = N.analyse(devs, o, {}); assert.strictEqual(r.suggestions.b.parentId, 'sw');
});
check('a box seen once by MAC and once by IP (no MAC) is listed once', () => {
  const o = [{ deviceId: 'a', gateway: '', arp: [], fdb: [], selfMacs: [], rows: [{ via: 'mndp', mac: '0c:b2:05:5f:00:00', ip: '192.168.229.130', name: 'MikroTik', platform: 'MikroTik', remotePort: '', localPort: 'ether1' }] },
    { deviceId: 'b', gateway: '', arp: [], fdb: [], selfMacs: [], rows: [{ via: 'cdp', mac: '', ip: '192.168.229.130', name: 'MikroTik', platform: 'MikroTik', remotePort: '', localPort: 'Et0/3' }] }];
  const r = N.analyse([{ id: 'a', name: 'A', ip: '1.1.1.1', type: 'mikrotik' }, { id: 'b', name: 'B', ip: '1.1.1.2', type: 'switch' }], o, {});
  assert.strictEqual(r.unknown.length, 1); assert.strictEqual(r.unknown[0].mac, '0c:b2:05:5f:00:00'); assert.deepStrictEqual(r.unknown[0].seenBy.sort(), ['A', 'B']);
});
check('the MAC tables give the real chain when everything sits on one wire', () => {
  // gateway - master - slave - switch - (s1, s2): all see each other, only the MAC tables show the order
  const devs = ['gw', 'master', 'slave', 'sw', 's1', 's2'].map((id) => ({ id, name: id, ip: '192.168.0.' + id.length + Math.abs(id.charCodeAt(0) % 90), type: id === 'sw' ? 'switch' : 'mikrotik' }));
  const mac = { gw: 'aa:00:00:00:00:01', master: 'aa:00:00:00:00:02', slave: 'aa:00:00:00:00:03', sw: 'aa:00:00:00:00:04', s1: 'aa:00:00:00:00:05', s2: 'aa:00:00:00:00:06' };
  const macs = {}; Object.keys(mac).forEach((k) => { macs[k] = [mac[k]]; });
  const row = (id) => ({ via: 'mndp', mac: mac[id], ip: '10.0.0.' + (id.charCodeAt(0) % 200), name: id, platform: id === 'sw' ? 'Cisco IOS' : 'MikroTik', remotePort: '', localPort: 'ether1' });
  const fdb = (m) => Object.keys(m).map((id) => ({ mac: mac[id], port: m[id] }));
  const obs = [
    { deviceId: 'master', gateway: '10.0.0.' + ('g'.charCodeAt(0) % 200), arp: [], selfMacs: [], rows: ['gw', 'slave', 'sw', 's1', 's2'].map(row), fdb: fdb({ gw: 'ether1', slave: 'ether2', sw: 'ether2', s1: 'ether2', s2: 'ether2' }) },
    { deviceId: 'slave', gateway: '', arp: [], selfMacs: [], rows: ['gw', 'master', 'sw', 's1', 's2'].map(row), fdb: fdb({ gw: 'ether1', master: 'ether1', sw: 'ether2', s1: 'ether2', s2: 'ether2' }) },
    { deviceId: 'sw', gateway: '', arp: [], selfMacs: [], rows: ['gw', 'master', 'slave', 's1', 's2'].map(row), fdb: fdb({ gw: 'Et0/0', master: 'Et0/0', slave: 'Et0/0', s1: 'Et0/1', s2: 'Et0/2' }) }
  ];
  const r = N.analyse(devs, obs, macs);
  assert.strictEqual(r.gatewayId, 'gw');
  assert.strictEqual(r.suggestions.master.parentId, 'gw'); assert.strictEqual(r.suggestions.slave.parentId, 'master'); assert.strictEqual(r.suggestions.sw.parentId, 'slave');
  assert.strictEqual(r.suggestions.s1.parentId, 'sw'); assert.strictEqual(r.suggestions.s2.parentId, 'sw'); assert.strictEqual(r.suggestions.s1.confidence, 'high');
});
check('without a MAC table the tree is not guessed (the old, weaker suggestions stay)', () => {
  const devs = [{ id: 'gw', name: 'gw', ip: '10.0.0.1', type: 'mikrotik' }, { id: 'a', name: 'a', ip: '10.0.0.2', type: 'mikrotik' }];
  const obs = [{ deviceId: 'a', gateway: '10.0.0.1', arp: [], fdb: [], selfMacs: [], rows: [{ via: 'mndp', mac: 'aa:00:00:00:00:01', ip: '10.0.0.1', name: 'gw', platform: 'MikroTik', remotePort: '', localPort: 'ether1' }] }];
  const r = N.analyse(devs, obs, {}); assert.strictEqual(r.suggestions.gw.parentId, 'internet'); assert.ok(!r.suggestions.a || r.suggestions.a.confidence !== 'high' || r.suggestions.a.parentId === 'gw');
});
check('nothing read means no suggestions and no crash', () => { const E = N.analyse(devices, [], {}); assert.deepStrictEqual(E.suggestions, {}); assert.deepStrictEqual(E.unknown, []); });
check('only routers and switches with an API or SNMP login can be scanned', () => { assert.ok(N.canScan({ method: 'snmp' })); assert.ok(N.canScan({ method: 'mikrotik' })); assert.ok(!N.canScan({ method: 'airos' })); assert.ok(!N.canScan({ method: 'ping' })); });
check('a cheap switch name is recognised', () => { assert.strictEqual(N.kindOf('', 'Switch'), 'switch'); assert.strictEqual(N.kindOf('cisco WS-C2960', 'x'), 'switch'); assert.strictEqual(N.kindOf('MikroTik', 'HRINS-Sm21'), ''); });

if (fails) { console.log('\n' + fails + ' neighbour test(s) failed'); process.exit(1); }
console.log('Neighbour tests passed.');
