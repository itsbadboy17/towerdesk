// A pretend EPON OLT with a few ONUs, for testing TowerDesk without real fibre hardware.
// There is no free OLT image for GNS3 (OLT firmware only ships inside the vendors' hardware), so this answers SNMP
// like a cheap C-Data / HSGQ style EPON OLT (the NSCRTV standard MIB TowerDesk already reads): ONU names, MAC
// addresses, online state, distance, optical power and temperature, plus a few interfaces with moving traffic.
// It invents everything and changes nothing anywhere. For testing only: never point it at real customers' data.
//
//   node scripts/mock-olt.js [--port 1161] [--bind 0.0.0.0] [--community public] [--onus 6]
//
// In TowerDesk: Add device -> type OLT, method SNMP, the address of this computer (127.0.0.1, or 192.168.229.1 from the
// GNS3 lab network), port 1161, community public. Some ONUs are weak on purpose and one drops off every few minutes.
const snmp = require('net-snmp');

const NS = '1.3.6.1.4.1.17409.2.3.4';
const NAMES = ['Home-Ahmed', 'Home-Zaid', 'Shop-Bilal', 'Home-Huda', 'Home-Mazen', 'Office-Firas', 'Home-Sara', 'Home-Omar'];

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def; }

// The invented ONUs. index = (device << 16) | (pon << 8) | onu, the way the NSCRTV tables number them.
function makeOnus(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const pon = (i % 2) + 1, onu = Math.floor(i / 2) + 1;
    out.push({
      idx: (1 << 16) | (pon << 8) | onu, name: NAMES[i % NAMES.length] + (i >= NAMES.length ? '-' + (i + 1) : ''),
      mac: Buffer.from([0x00, 0x1e, 0xa6, 0x10 + pon, 0x00, onu]),
      base: i === 2 ? -27.4 : -19 - ((i * 7) % 5) * 0.9,     // the third ONU has weak light on purpose
      dist: 600 + i * 1350, drops: i === 3                  // the fourth one drops off for a minute every five
    });
  }
  return out;
}

// What an ONU reads at a moment in time (deterministic, so tests can predict it).
function reading(onu, nowMs) {
  const t = nowMs / 1000;
  const cycle = t % 300;
  const online = !(onu.drops && cycle >= 120 && cycle < 180);
  const wobble = Math.sin(t / 37 + onu.idx) * 0.35;
  return { online, rx: online ? Math.round((onu.base + wobble) * 100) : -4000, tx: online ? 230 : 0, temp: online ? 4300 + Math.round(Math.sin(t / 91 + onu.idx) * 150) : 0 };
}

function start(opts) {
  opts = opts || {};
  const port = Number(opts.port) || 1161, community = opts.community || 'public', count = Math.max(1, Math.min(64, Number(opts.onus) || 6));
  const onus = makeOnus(count);
  const agent = snmp.createAgent({ port, address: opts.bind || '0.0.0.0', accessControlModelType: snmp.AccessControlModelType.Simple }, () => {});
  agent.getAuthorizer().addCommunity(community);
  const mib = agent.getMib();
  const MA = snmp.MaxAccess, T = snmp.ObjectType;

  const scalar = (name, oid, type, value) => { mib.registerProvider({ name, type: snmp.MibProviderType.Scalar, oid, scalarType: type, maxAccess: MA['read-only'] }); mib.setScalarValue(name, value); };
  scalar('sysDescr', '1.3.6.1.2.1.1.1', T.OctetString, 'EPON OLT (TowerDesk pretend, for testing)');
  scalar('sysObjectID', '1.3.6.1.2.1.1.2', T.OID, '1.3.6.1.4.1.17409.1.1');
  scalar('sysName', '1.3.6.1.2.1.1.5', T.OctetString, 'Lab-OLT');

  // ONU list (NSCRTV): name 2, mac 7, oper 8, distance 15
  const col = (number, name, type) => ({ number, name, type, maxAccess: MA['read-only'] });
  mib.registerProvider({
    name: 'onuTable', type: snmp.MibProviderType.Table, oid: NS + '.1.1', maxAccess: MA['not-accessible'],
    tableColumns: [col(1, 'onuIndex', T.Integer), col(2, 'onuName', T.OctetString), col(7, 'onuMac', T.OctetString), col(8, 'onuOper', T.Integer), col(15, 'onuDist', T.Integer)],
    tableIndex: [{ columnName: 'onuIndex' }]
  });
  // Optical power and temperature: indexed device.card.port, rx 4, tx 5 (0.01 dBm), temp 8 (0.01 C)
  mib.registerProvider({
    name: 'opticalTable', type: snmp.MibProviderType.Table, oid: NS + '.2.1', maxAccess: MA['not-accessible'],
    tableColumns: [col(1, 'optDev', T.Integer), col(2, 'optCard', T.Integer), col(3, 'optPort', T.Integer), col(4, 'optRx', T.Integer), col(5, 'optTx', T.Integer), col(8, 'optTemp', T.Integer)],
    tableIndex: [{ columnName: 'optDev' }, { columnName: 'optCard' }, { columnName: 'optPort' }]
  });
  const now = Date.now();
  onus.forEach((o) => {
    const r = reading(o, now);
    mib.addTableRow('onuTable', [o.idx, o.name, o.mac, r.online ? 1 : 2, o.dist]);
    mib.addTableRow('opticalTable', [o.idx, 1, 1, r.rx, r.tx, r.temp]);
  });

  // A few interfaces with traffic (IF-MIB ifTable): two PON ports and an uplink
  const ifs = [{ name: 'EPON0/1', speed: 1000e6 }, { name: 'EPON0/2', speed: 1000e6 }, { name: 'GE0/1', speed: 1000e6 }];
  mib.registerProvider({
    name: 'ifTable', type: snmp.MibProviderType.Table, oid: '1.3.6.1.2.1.2.2.1', maxAccess: MA['not-accessible'],
    tableColumns: [col(1, 'ifIndex', T.Integer), col(2, 'ifDescr', T.OctetString), col(3, 'ifType', T.Integer), col(5, 'ifSpeed', T.Gauge32), col(8, 'ifOperStatus', T.Integer), col(10, 'ifInOctets', T.Counter32), col(16, 'ifOutOctets', T.Counter32)],
    tableIndex: [{ columnName: 'ifIndex' }]
  });
  const counters = ifs.map(() => ({ rx: 0, tx: 0 }));
  ifs.forEach((f, i) => mib.addTableRow('ifTable', [i + 1, f.name, 6, f.speed, 1, 0, 0]));

  let last = now;
  const timer = setInterval(() => {
    const t = Date.now(), dt = (t - last) / 1000; last = t;
    onus.forEach((o) => {
      const r = reading(o, t);
      mib.setTableSingleCell('onuTable', 8, [o.idx], r.online ? 1 : 2);
      mib.setTableSingleCell('opticalTable', 4, [o.idx, 1, 1], r.rx);
      mib.setTableSingleCell('opticalTable', 5, [o.idx, 1, 1], r.tx);
      mib.setTableSingleCell('opticalTable', 8, [o.idx, 1, 1], r.temp);
    });
    ifs.forEach((f, i) => {
      const load = 0.2 + 0.15 * Math.sin(t / 20000 + i), c = counters[i];
      c.rx = (c.rx + Math.round(f.speed / 8 * load * dt)) % 4294967296; c.tx = (c.tx + Math.round(f.speed / 8 * load * 0.6 * dt)) % 4294967296;
      mib.setTableSingleCell('ifTable', 10, [i + 1], c.rx);
      mib.setTableSingleCell('ifTable', 16, [i + 1], c.tx);
    });
  }, 5000);
  timer.unref();
  return { agent, stop() { clearInterval(timer); try { agent.close(); } catch (e) { /* closed */ } }, onus };
}

module.exports = { start, makeOnus, reading };

if (require.main === module) {
  const s = start({ port: arg('port', 1161), bind: arg('bind', '0.0.0.0'), community: arg('community', 'public'), onus: arg('onus', 6) });
  console.log('Pretend OLT with ' + s.onus.length + ' ONUs listening on UDP ' + arg('port', 1161) + ', community ' + arg('community', 'public'));
  process.on('SIGINT', () => { s.stop(); process.exit(0); });
}
