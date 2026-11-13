// OLT reader: each vendor profile's parsing (offline, from table dumps shaped like a real walk),
// the SAS matching of ONUs, and one end-to-end read against a fake SNMP agent on localhost.
const snmp = require('net-snmp');
const olt = require('../src/transports/olt');
const lookup = require('../src/lookup');

let failed = 0;
function ok(name, cond) {
  console.log((cond ? 'pass  ' : 'FAIL  ') + name);
  if (!cond) failed++;
}

// ---- value helpers ----
ok('gpon serial: vendor letters + hex', olt.serial(Buffer.from([0x48, 0x57, 0x54, 0x43, 0x1a, 0x2b, 0x3c, 0x4d])) === 'HWTC1A2B3C4D');
ok('mac from 6 bytes', olt.mac(Buffer.from([0x00, 0x1b, 0x2c, 0x3d, 0x4e, 0x5f])) === '00:1B:2C:3D:4E:5F');
ok('mac from text', olt.mac('00-1b-2c-3d-4e-5f') === '00:1B:2C:3D:4E:5F');

// ---- Huawei GPON ----
const hw = olt.profile('huawei').parse({
  sn: { '4194312448.0': Buffer.from('4857544301020304', 'hex'), '4194312448.1': Buffer.from('4857544305060708', 'hex') },
  desc: { '4194312448.0': Buffer.from('ali@isp'), '4194312448.1': Buffer.from('') },
  run: { '4194312448.0': 1, '4194312448.1': 2 },
  dist: { '4194312448.0': 1530, '4194312448.1': -1 },
  temp: { '4194312448.0': 46, '4194312448.1': 2147483647 },
  tx: { '4194312448.0': 215, '4194312448.1': 2147483647 },
  rx: { '4194312448.0': -1987, '4194312448.1': 2147483647 },
  oltRx: { '4194312448.0': 7890, '4194312448.1': 2147483647 },
  ifName: { '4194312448': Buffer.from('GPON 0/1/3') }
});
ok('huawei: two ONTs', hw.length === 2);
ok('huawei: port and name', hw[0].port === 'GPON 0/1/3:0' && hw[0].name === 'ali@isp' && hw[0].serial === 'HWTC01020304');
ok('huawei: rx/tx in dBm', hw[0].signal === -19.87 && hw[0].txPower === 2.15);
ok('huawei: OLT-side rx offset', hw[0].oltRx === -21.1);
ok('huawei: temperature and distance', hw[0].temp === 46 && hw[0].distance === 1530);
ok('huawei: offline ONT has no readings', hw[1].online === false && hw[1].signal === null && hw[1].temp === null && hw[1].distance === null);

// ---- ZTE GPON ----
const zte = olt.profile('zte').parse({
  sn: { '268501248.1': Buffer.from('5a54454701020304', 'hex'), '268501248.2': Buffer.from('5a54454705060708', 'hex') },
  name: { '268501248.1': Buffer.from('sara@isp'), '268501248.2': Buffer.from('ONU-2') },
  phase: { '268501248.1': 4, '268501248.2': 7 },
  rx: { '268501248.1.1': 5200, '268501248.2.1': 0 },   // 5200*0.002-30 = -19.6
  tx: { '268501248.1.1': 16100 },                       // 16100*0.002-30 = 2.2
  temp: { '268501248.1.1': 11776 }                      // /256 = 46
});
ok('zte: port decoded from the index', zte[0].port === 'gpon-onu_1/1/1:1');
ok('zte: serial and name', zte[0].serial === 'ZTEG01020304' && zte[0].name === 'sara@isp');
ok('zte: levels', zte[0].signal === -19.6 && zte[0].txPower === 2.2 && zte[0].temp === 46);
ok('zte: working vs offline', zte[0].online === true && zte[1].online === false);

// ---- BDCOM EPON ----
const bd = olt.profile('bdcom').parse({
  mac: { '17': Buffer.from('001b2c3d4e5f', 'hex'), '18': Buffer.from('001b2c3d4e60', 'hex') },
  temp: { '17': 11520 }, rx: { '17': -213 }, tx: { '17': 21 },
  ifDescr: { '17': Buffer.from('EPON0/1:1'), '18': Buffer.from('EPON0/1:2') },
  ifAlias: { '17': Buffer.from('omar@isp') },
  oper: { '17': 1, '18': 2 }
});
ok('bdcom: mac, port, name', bd[0].mac === '00:1B:2C:3D:4E:5F' && bd[0].port === 'EPON0/1:1' && bd[0].name === 'omar@isp');
ok('bdcom: tenths of a dBm, 1/256 degree', bd[0].signal === -21.3 && bd[0].txPower === 2.1 && bd[0].temp === 45);
ok('bdcom: second ONU is down', bd[1].online === false && bd[1].signal === null);

// ---- NSCRTV standard EPON (C-Data, HSGQ) ----
const ns = olt.profile('nscrtv').parse({
  mac: { '16843008': Buffer.from('a0b1c2d3e4f5', 'hex') },
  name: { '16843008': Buffer.from('noor@isp') },
  oper: { '16843008': 1 }, dist: { '16843008': 842 },
  rx: { '16843008.0.1': -2245 }, tx: { '16843008.0.1': 231 }, temp: { '16843008.0.1': 4380 }
});
ok('nscrtv: hundredths', ns[0].signal === -22.45 && ns[0].txPower === 2.31 && ns[0].temp === 43.8);
ok('nscrtv: mac, name, distance', ns[0].mac === 'A0:B1:C2:D3:E4:F5' && ns[0].name === 'noor@isp' && ns[0].distance === 842);

// ---- profile choice ----
ok('huawei object id tries huawei first', olt.candidates('1.3.6.1.4.1.2011.2.248').map((p) => p.id)[0] === 'huawei');
ok('bdcom object id tries bdcom first', olt.candidates('1.3.6.1.4.1.3320.1.1').map((p) => p.id)[0] === 'bdcom');
ok('unknown object id still tries every profile', olt.candidates('1.3.6.1.4.1.99999').length === olt.PROFILES.length);

// ---- SAS matching: EPON ONU by MAC, GPON ONU by its name ----
const subs = [
  { username: 'omar@isp', mac: '00:1B:2C:3D:4E:5F', online: true },
  { username: 'ALI@isp', mac: 'AA:AA:AA:00:00:01', online: true },
  { username: 'dup@isp', mac: 'AA:AA:AA:00:00:02', online: true },
  { username: 'nobody@isp', mac: 'AA:AA:AA:00:00:03', online: true }
];
const res = lookup.attachStations(subs, [
  { id: 'o1', name: 'OLT A', metrics: { onus: bd.concat(hw, [{ name: 'dup@isp', serial: 'X1' }, { name: 'dup@isp', serial: 'X2' }]) } }
]);
ok('epon ONU matched by MAC', subs[0].station && subs[0].station.onu && subs[0].station.signal === -21.3 && subs[0].station.temp === 45 && !subs[0].station.byName);
ok('gpon ONU matched by name, case-insensitive', subs[1].station && subs[1].station.byName === true && subs[1].station.serial === 'HWTC01020304' && subs[1].station.temp === 46);
ok('two ONUs with one name match nobody', subs[2].station === null);
ok('unknown user stays unmatched', subs[3].station === null && res.named === 1);
ok('ONUs without a MAC are not listed as unknown radios', res.unmatchedStations.every((u) => u.mac));

// ---- end to end: a fake Huawei OLT answering SNMP on localhost ----
async function live() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const agent = snmp.createAgent({ port, address: '127.0.0.1', disableAuthorization: true }, () => {});
  const mib = agent.getMib();
  const HW = '1.3.6.1.4.1.2011.6.128.1.1.2';
  const col = (number, name, type) => ({ number, name, type, maxAccess: snmp.MaxAccess['read-only'] });
  const idx = [
    { number: 100, name: 'ifIdx', type: snmp.ObjectType.Integer, maxAccess: snmp.MaxAccess['not-accessible'] },
    { number: 101, name: 'ontIdx', type: snmp.ObjectType.Integer, maxAccess: snmp.MaxAccess['not-accessible'] }
  ];
  const table = (name, oid, cols) => mib.registerProvider({
    name, type: snmp.MibProviderType.Table, oid, maxAccess: snmp.MaxAccess['not-accessible'],
    tableColumns: idx.concat(cols), tableIndex: [{ columnName: 'ifIdx' }, { columnName: 'ontIdx' }]
  });
  table('ontCfg', HW + '.43.1', [col(3, 'sn', snmp.ObjectType.OctetString), col(9, 'desc', snmp.ObjectType.OctetString)]);
  table('ontCtl', HW + '.46.1', [col(15, 'run', snmp.ObjectType.Integer), col(20, 'dist', snmp.ObjectType.Integer)]);
  table('ontDdm', HW + '.51.1', [col(1, 'temp', snmp.ObjectType.Integer), col(3, 'tx', snmp.ObjectType.Integer), col(4, 'rx', snmp.ObjectType.Integer), col(6, 'oltRx', snmp.ObjectType.Integer)]);
  mib.registerProvider({ name: 'sysObjectID', type: snmp.MibProviderType.Scalar, oid: '1.3.6.1.2.1.1.2', scalarType: snmp.ObjectType.OID, maxAccess: snmp.MaxAccess['read-only'] });
  mib.setScalarValue('sysObjectID', '1.3.6.1.4.1.2011.2.248');
  mib.addTableRow('ontCfg', [7, 0, Buffer.from('4857544301020304', 'hex'), 'ali@isp']);
  mib.addTableRow('ontCfg', [7, 1, Buffer.from('4857544305060708', 'hex'), 'sara@isp']);
  mib.addTableRow('ontCtl', [7, 0, 1, 1530]);
  mib.addTableRow('ontCtl', [7, 1, 2, -1]);
  mib.addTableRow('ontDdm', [7, 0, 46, 215, -2790, 7090]);
  mib.addTableRow('ontDdm', [7, 1, 2147483647, 2147483647, 2147483647, 2147483647]);
  try {
    const conn = { host: '127.0.0.1', port, community: 'public', version: '2c', timeout: 3000 };
    const r = await olt.readOnus(conn);
    ok('live: detected as Huawei', !!r && r.profile === 'huawei');
    ok('live: both ONTs read', !!r && r.onus.length === 2);
    const a = r && r.onus.find((o) => o.serial === 'HWTC01020304');
    ok('live: readings', !!a && a.name === 'ali@isp' && a.online && a.signal === -27.9 && a.txPower === 2.15 && a.oltRx === -29.1 && a.temp === 46 && a.distance === 1530);
    const b = r && r.onus.find((o) => o.serial === 'HWTC05060708');
    ok('live: offline ONT kept, without readings', !!b && b.online === false && b.signal === null && b.temp === null);
    const again = await olt.readOnus(conn, 'huawei');
    ok('live: known profile skips detection', !!again && again.onus.length === 2);
    const none = await olt.readOnus(conn, 'bdcom');
    ok('live: wrong family finds nothing', none === null);
  } finally {
    agent.close();
  }
}

live().catch((e) => { console.log('FAIL  live read threw: ' + e.message); failed++; }).then(() => {
  if (failed) { console.log(failed + ' OLT test(s) failed.'); process.exit(1); }
  console.log('OLT tests passed.');
  process.exit(0);
});
