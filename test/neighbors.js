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
check('nothing read means no suggestions and no crash', () => { const E = N.analyse(devices, [], {}); assert.deepStrictEqual(E.suggestions, {}); assert.deepStrictEqual(E.unknown, []); });
check('only routers and switches with an API or SNMP login can be scanned', () => { assert.ok(N.canScan({ method: 'snmp' })); assert.ok(N.canScan({ method: 'mikrotik' })); assert.ok(!N.canScan({ method: 'airos' })); assert.ok(!N.canScan({ method: 'ping' })); });
check('a cheap switch name is recognised', () => { assert.strictEqual(N.kindOf('', 'Switch'), 'switch'); assert.strictEqual(N.kindOf('cisco WS-C2960', 'x'), 'switch'); assert.strictEqual(N.kindOf('MikroTik', 'HRINS-Sm21'), ''); });

if (fails) { console.log('\n' + fails + ' neighbour test(s) failed'); process.exit(1); }
console.log('Neighbour tests passed.');
