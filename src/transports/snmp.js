// SNMP v1/v2c read (GET of the standard system group). Read-only.
const snmp = require('net-snmp');
const { friendlyError } = require('./common');

const OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysObjectID: '1.3.6.1.2.1.1.2.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0'
};

// IANA enterprise numbers in sysObjectID (1.3.6.1.4.1.<n>...) -> TowerDesk device type.
const ENTERPRISES = { 14988: 'mikrotik', 41112: 'ubnt', 10002: 'ubnt', 43356: 'mimosa', 9: 'cisco', 11863: 'tplink', 3320: 'olt', 17409: 'olt', 34592: 'olt', 50224: 'olt', 37950: 'olt' };

function vendorFromObjectId(oid) {
  const m = String(oid || '').match(/^1\.3\.6\.1\.4\.1\.(\d+)(\.|$)/);
  return m ? ENTERPRISES[m[1]] || null : null;
}

function formatUptime(ticks) {
  const s = Math.floor(Number(ticks) / 100);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function test({ host, port = 161, community = 'public', version = '2c', timeout = 4000 }) {
  return new Promise((resolve) => {
    let session;
    try {
      session = snmp.createSession(host, community || 'public', {
        port,
        version: version === '1' ? snmp.Version1 : snmp.Version2c,
        timeout,
        retries: 1
      });
    } catch (err) {
      return resolve({ ok: false, error: friendlyError(err) });
    }
    session.on('error', () => { /* reported via the get callback */ });
    const names = Object.keys(OIDS);
    session.get(names.map((n) => OIDS[n]), (err, varbinds) => {
      session.close();
      if (err) return resolve({ ok: false, error: friendlyError(err) });
      const d = {};
      varbinds.forEach((vb, i) => {
        if (!snmp.isVarbindError(vb)) d[names[i]] = Buffer.isBuffer(vb.value) ? vb.value.toString('utf8') : vb.value;
      });
      if (d.sysUpTime !== undefined) d.uptime = formatUptime(d.sysUpTime);
      resolve({
        ok: true,
        summary: (d.sysName ? d.sysName + ' — ' : '') + String(d.sysDescr || 'SNMP reply').slice(0, 120),
        details: { name: d.sysName, description: d.sysDescr, uptime: d.uptime, location: d.sysLocation, objectId: d.sysObjectID ? String(d.sysObjectID) : undefined }
      });
    });
  });
}

// Counter64 values arrive as big-endian Buffers.
function counterValue(v) {
  if (Buffer.isBuffer(v)) return v.length ? Number(BigInt('0x' + v.toString('hex'))) : 0;
  return Number(v);
}

function tableColumns(session, oid, columns) {
  return new Promise((resolve, reject) => {
    session.tableColumns(oid, columns, 20, (err, table) => (err ? reject(err) : resolve(table)));
  });
}

// Per-interface byte counters. Prefers 64-bit IF-MIB::ifXTable (v2c), falls back to the
// 32-bit ifTable. Read-only.
async function readInterfaces({ host, port = 161, community = 'public', version = '2c', timeout = 4000 }) {
  const session = snmp.createSession(host, community || 'public', {
    port, version: version === '1' ? snmp.Version1 : snmp.Version2c, timeout, retries: 0
  });
  session.on('error', () => {});
  try {
    let rows = null;
    let bits = 64;
    if (version !== '1') {
      try {
        const x = await tableColumns(session, '1.3.6.1.2.1.31.1.1', [1, 6, 10]);
        rows = Object.keys(x).map((idx) => ({ idx, name: x[idx][1], rx: x[idx][6], tx: x[idx][10] }));
      } catch (e) { rows = null; }
    }
    let status = {};
    try {
      const t = await tableColumns(session, '1.3.6.1.2.1.2.2', rows && rows.length ? [8] : [2, 8, 10, 16]);
      Object.keys(t).forEach((idx) => { status[idx] = t[idx]; });
      if (!rows || !rows.length) {
        bits = 32;
        rows = Object.keys(t).map((idx) => ({ idx, name: t[idx][2], rx: t[idx][10], tx: t[idx][16] }));
      }
    } catch (e) {
      if (!rows) throw e;
    }
    return rows
      .filter((r) => r.rx !== undefined && r.tx !== undefined)
      .map((r) => ({
        name: Buffer.isBuffer(r.name) ? r.name.toString('utf8') : String(r.name || 'if' + r.idx),
        up: status[r.idx] ? Number(status[r.idx][8]) === 1 : true,
        rxBytes: counterValue(r.rx),
        txBytes: counterValue(r.tx),
        counterBits: bits
      }));
  } finally {
    session.close();
  }
}

// Neighbour-related tables, all best effort: a table the device does not have is simply empty.
// MikroTik neighbour discovery (also carries Cisco CDP and LLDP sightings), standard LLDP and CDP,
// the ARP table, the default route, the MAC (bridge forwarding) table and the device's own MACs.
// Read-only.
async function readNeighborTables({ host, port = 161, community = 'public', version = '2c', timeout = 4000 }) {
  const session = snmp.createSession(host, community || 'public', {
    port, version: version === '1' ? snmp.Version1 : snmp.Version2c, timeout, retries: 0
  });
  session.on('error', () => {});
  const tc = (oid, cols) => tableColumns(session, oid, cols).catch(() => ({}));
  const getOne = (oid) => new Promise((resolve) => session.get([oid], (err, vb) => resolve(err || !vb || !vb[0] || snmp.isVarbindError(vb[0]) ? null : vb[0].value)));
  const hex6 = (b) => (Buffer.isBuffer(b) && b.length === 6 ? b.toString('hex').replace(/(..)(?!$)/g, '$1:') : '');
  const txt = (b) => (Buffer.isBuffer(b) ? b.toString('utf8') : (b === undefined || b === null ? '' : String(b)));
  const ipOf = (b) => (Buffer.isBuffer(b) && b.length === 4 ? Array.from(b).join('.') : (typeof b === 'string' ? b : ''));
  const vals = (t) => Object.keys(t).map((k) => Object.assign({ _k: k }, t[k]));
  try {
    const [mndp, lldp, cdp, arp, gw, fdb, bp, ifx, ifs] = await Promise.all([
      tc('1.3.6.1.4.1.14988.1.1.11.1', [2, 3, 4, 5, 6, 8]),
      tc('1.0.8802.1.1.2.1.4.1', [5, 7, 8, 9]),
      tc('1.3.6.1.4.1.9.9.23.1.2.1', [4, 5, 6, 7, 8]),
      tc('1.3.6.1.2.1.4.22', [2]),
      getOne('1.3.6.1.2.1.4.21.1.7.0.0.0.0'),
      tc('1.3.6.1.2.1.17.4.3', [1, 2]),
      tc('1.3.6.1.2.1.17.1.4', [2]),
      tc('1.3.6.1.2.1.31.1.1', [1]),
      tc('1.3.6.1.2.1.2.2', [6])
    ]);
    const ifNames = {};
    Object.keys(ifx).forEach((i) => { ifNames[i] = txt(ifx[i][1]); });
    const portName = {};
    Object.keys(bp).forEach((p) => { portName[p] = ifNames[bp[p][2]] || 'port' + p; });
    return {
      mndp: vals(mndp).map((r) => ({ ip: ipOf(r[2]), mac: hex6(r[3]), version: txt(r[4]), platform: txt(r[5]), identity: txt(r[6]), ifIndex: r[8] })),
      lldp: vals(lldp).map((r) => { const parts = r._k.split('.'); return { local: parts.length >= 2 ? parts[parts.length - 2] : undefined, chassis: r[5], portId: txt(r[7]), portDesc: txt(r[8]), sysName: txt(r[9]) }; }),
      cdp: vals(cdp).map((r) => ({ ifIndex: r._k.split('.')[0], addr: ipOf(r[4]), version: txt(r[5]), deviceId: txt(r[6]), port: txt(r[7]), platform: txt(r[8]) })),
      arp: Object.keys(arp).map((k) => ({ ip: k.split('.').slice(1).join('.'), mac: hex6(arp[k][2]) })).filter((a) => a.mac),
      gateway: gw === null ? '' : (typeof gw === 'string' ? gw : ipOf(gw)),
      fdb: Object.keys(fdb).map((k) => ({ mac: hex6(fdb[k][1]), port: portName[fdb[k][2]] || 'port' + fdb[k][2] })).filter((x) => x.mac),
      ifNames,
      selfMacs: vals(ifs).map((r) => hex6(r[6])).filter(Boolean)
    };
  } finally {
    session.close();
  }
}

module.exports = { test, readInterfaces, readNeighborTables, vendorFromObjectId };
