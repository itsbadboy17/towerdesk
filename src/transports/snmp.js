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
const ENTERPRISES = { 14988: 'mikrotik', 41112: 'ubnt', 10002: 'ubnt', 43356: 'mimosa', 9: 'cisco', 11863: 'tplink' };

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

module.exports = { test, readInterfaces, vendorFromObjectId };
