// OLT reader: the ONUs registered on a PON OLT, with their optical power and temperature, over
// SNMP v1/v2c. Read-only (walks only).
//
// Each vendor keeps this in its own enterprise tables, so there is one small profile per family:
//   huawei  HUAWEI-XPON-MIB   GPON ONTs (MA56xx / MA58xx / EA58xx)
//   zte     ZXGPON-*-MIB      GPON ONUs (C300 / C320)
//   bdcom   NMS-EPON-*        EPON ONUs (P33xx)
//   nscrtv  NSCRTV-EPON-ONU   the Chinese standard EPON MIB: C-Data, HSGQ and many small OLTs
// The profile is picked from sysObjectID where possible, otherwise each is tried in turn and the
// first that lists an ONU wins. Parsing is separate from the walking so it is tested offline.
const snmp = require('net-snmp');

const MAX_ONUS = 2048;
const INVALID = 2147483647;

// ---- value helpers ----
function num(v) {
  if (v === undefined || v === null) return null;
  if (Buffer.isBuffer(v)) { const n = Number(v.toString('utf8').trim()); return Number.isFinite(n) && v.length ? n : null; }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function text(v) {
  if (v === undefined || v === null) return '';
  const s = Buffer.isBuffer(v) ? v.toString('utf8') : String(v);
  return s.replace(/[\u0000-\u001f]/g, '').trim();
}
function mac(v) {
  if (Buffer.isBuffer(v) && v.length === 6) return Array.from(v).map((b) => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
  const k = text(v).toLowerCase().replace(/[^0-9a-f]/g, '');
  return k.length === 12 ? k.match(/../g).join(':').toUpperCase() : '';
}
// GPON serial: 4 vendor letters + 4 bytes, shown the usual way ("HWTC1A2B3C4D").
function serial(v) {
  if (!Buffer.isBuffer(v)) return text(v).toUpperCase();
  if (v.length !== 8) return /^[\x20-\x7e]+$/.test(v.toString('latin1')) ? v.toString('latin1').trim().toUpperCase() : v.toString('hex').toUpperCase();
  const head = v.subarray(0, 4);
  const letters = head.every((b) => b >= 0x30 && b <= 0x7a);
  return (letters ? head.toString('latin1') : head.toString('hex')).toUpperCase() + v.subarray(4).toString('hex').toUpperCase();
}
function round(n, places) {
  if (n === null || !Number.isFinite(n)) return null;
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
// A reading only counts when it is a plausible optical level / temperature: OLTs report
// offline ONUs with sentinels (2147483647, -40.00, 0 ...) that must not be shown as real.
function dbm(n) { return n !== null && n > -50 && n < 12 ? round(n, 2) : null; }
function celsius(n) { return n !== null && n > -45 && n < 130 ? round(n, 1) : null; }
function metres(n) { return n !== null && n >= 0 && n < 100000 ? Math.round(n) : null; }
function scaled(v, div) { const n = num(v); return n === null || n === INVALID || n === -INVALID - 1 ? null : n / div; }

// ---- profiles: parse(tables) -> ONU list. `tables` is { key: { index: value } }. ----
const HW = '1.3.6.1.4.1.2011.6.128.1.1.2';
const ZTE = '1.3.6.1.4.1.3902.1012.3';
const BD = '1.3.6.1.4.1.3320.101';
const NS = '1.3.6.1.4.1.17409.2.3.4';
const IFNAME = '1.3.6.1.2.1.31.1.1.1.1';
const IFDESCR = '1.3.6.1.2.1.2.2.1.2';
const IFALIAS = '1.3.6.1.2.1.31.1.1.1.18';
const IFOPER = '1.3.6.1.2.1.2.2.1.8';

const PROFILES = [
  {
    id: 'huawei', label: 'Huawei GPON', enterprises: [2011],
    probe: 'sn',
    columns: {
      sn: HW + '.43.1.3', desc: HW + '.43.1.9', run: HW + '.46.1.15', dist: HW + '.46.1.20',
      temp: HW + '.51.1.1', tx: HW + '.51.1.3', rx: HW + '.51.1.4', oltRx: HW + '.51.1.6', ifName: IFNAME
    },
    parse(t) {
      return Object.keys(t.sn || {}).map((idx) => {
        const [ifIndex, ont] = idx.split('.');
        const port = text((t.ifName || {})[ifIndex]);
        const olt = scaled((t.oltRx || {})[idx], 1);
        return {
          port: (port || 'PON ' + ifIndex) + ':' + ont,
          name: text((t.desc || {})[idx]),
          serial: serial(t.sn[idx]),
          online: num((t.run || {})[idx]) === 1,
          signal: dbm(scaled((t.rx || {})[idx], 100)),
          txPower: dbm(scaled((t.tx || {})[idx], 100)),
          oltRx: dbm(olt === null ? null : (olt - 10000) / 100),
          temp: celsius(scaled((t.temp || {})[idx], 1)),
          distance: metres(scaled((t.dist || {})[idx], 1))
        };
      });
    }
  },
  {
    id: 'zte', label: 'ZTE GPON', enterprises: [3902],
    probe: 'sn',
    columns: {
      name: ZTE + '.28.1.1.2', sn: ZTE + '.28.1.1.5', phase: ZTE + '.28.2.1.4',
      rx: ZTE + '.50.12.1.1.10', tx: ZTE + '.50.12.1.1.14', temp: ZTE + '.50.12.1.1.19'
    },
    parse(t) {
      // Optical rows carry one more index part (the ONU's PON port, normally 1).
      const optical = (col, idx) => { const m = t[col] || {}; return m[idx + '.1'] !== undefined ? m[idx + '.1'] : m[idx]; };
      // OMCI levels: unsigned 16-bit two's complement in 0.002 dB steps, offset 30 dB.
      const level = (v) => { let n = num(v); if (n === null) return null; if (n > 32767) n -= 65536; return dbm(n * 0.002 - 30); };
      return Object.keys(t.sn || {}).map((idx) => {
        const [ifIndex, onu] = idx.split('.');
        const i = Number(ifIndex);
        const tRaw = num(optical('temp', idx));
        return {
          port: 'gpon-onu_1/' + ((i >> 16) & 0xff) + '/' + ((i >> 8) & 0xff) + ':' + onu,
          name: text((t.name || {})[idx]),
          serial: serial(t.sn[idx]),
          online: num((t.phase || {})[idx]) === 4, // 4 = working; 2 LOS, 5 dying gasp, 7 offline
          signal: level(optical('rx', idx)),
          txPower: level(optical('tx', idx)),
          oltRx: null,
          temp: celsius(tRaw === null ? null : (tRaw > 32767 ? tRaw - 65536 : tRaw) / 256),
          distance: null
        };
      });
    }
  },
  {
    id: 'bdcom', label: 'BDCOM EPON', enterprises: [3320],
    probe: 'mac',
    columns: {
      mac: BD + '.10.1.1.3', temp: BD + '.10.5.1.2', rx: BD + '.10.5.1.5', tx: BD + '.10.5.1.6',
      ifDescr: IFDESCR, ifAlias: IFALIAS, oper: IFOPER
    },
    parse(t) {
      return Object.keys(t.mac || {}).map((idx) => ({
        port: text((t.ifDescr || {})[idx]) || 'ONU ' + idx,
        name: text((t.ifAlias || {})[idx]),
        mac: mac(t.mac[idx]),
        online: num((t.oper || {})[idx]) === 1,
        signal: dbm(scaled((t.rx || {})[idx], 10)),
        txPower: dbm(scaled((t.tx || {})[idx], 10)),
        oltRx: null,
        temp: celsius(scaled((t.temp || {})[idx], 256)),
        distance: null
      })).filter((o) => o.mac);
    }
  },
  {
    id: 'nscrtv', label: 'EPON (C-Data / HSGQ standard MIB)', enterprises: [17409, 34592, 50224, 37950],
    probe: 'mac',
    columns: {
      name: NS + '.1.1.2', mac: NS + '.1.1.7', oper: NS + '.1.1.8', dist: NS + '.1.1.15',
      rx: NS + '.2.1.4', tx: NS + '.2.1.5', temp: NS + '.2.1.8'
    },
    parse(t) {
      // Optical rows are indexed device.card.port; keep the first row of each ONU.
      const first = (col) => {
        const out = {};
        Object.keys(t[col] || {}).forEach((k) => { const dev = k.split('.')[0]; if (out[dev] === undefined) out[dev] = t[col][k]; });
        return out;
      };
      const rx = first('rx'), tx = first('tx'), temp = first('temp');
      return Object.keys(t.mac || {}).map((idx) => {
        const i = Number(idx);
        return {
          port: 'PON ' + ((i >> 16) & 0xff) + ':' + ((i >> 8) & 0xff || i & 0xff),
          name: text((t.name || {})[idx]),
          mac: mac(t.mac[idx]),
          online: num((t.oper || {})[idx]) === 1,
          signal: dbm(scaled(rx[idx], 100)),
          txPower: dbm(scaled(tx[idx], 100)),
          oltRx: null,
          temp: celsius(scaled(temp[idx], 100)),
          distance: metres(scaled((t.dist || {})[idx], 1))
        };
      }).filter((o) => o.mac);
    }
  }
];

function profile(id) { return PROFILES.find((p) => p.id === id) || null; }

// Profiles to try, the one matching the device's enterprise number first.
function candidates(objectId) {
  const m = String(objectId || '').match(/^1\.3\.6\.1\.4\.1\.(\d+)(\.|$)/);
  const ent = m ? Number(m[1]) : null;
  return PROFILES.slice().sort((a, b) => (b.enterprises.includes(ent) ? 1 : 0) - (a.enterprises.includes(ent) ? 1 : 0));
}

function isOltObjectId(objectId) {
  const m = String(objectId || '').match(/^1\.3\.6\.1\.4\.1\.(\d+)(\.|$)/);
  return !!m && PROFILES.some((p) => p.enterprises.includes(Number(m[1])) && p.id !== 'huawei' && p.id !== 'zte');
}

// ---- walking ----
function walkColumn(session, oid) {
  return new Promise((resolve, reject) => {
    const out = {};
    let n = 0;
    const feed = (varbinds) => {
      let good = 0;
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) continue;
        good++;
        out[String(vb.oid).slice(oid.length + 1)] = vb.value;
        if (++n >= MAX_ONUS * 2) return true; // stop a runaway walk
      }
      // A reply with nothing usable means the end of the device's data: some agents keep
      // answering 'no such object' for ever instead of ending the walk.
      return good === 0;
    };
    session.subtree(oid, 30, feed, (err) => (err ? reject(err) : resolve(out)));
  });
}

async function readProfile(session, p) {
  const tables = {};
  // The probe column decides whether this is the right family; a timeout there is a real error.
  tables[p.probe] = await walkColumn(session, p.columns[p.probe]);
  if (!Object.keys(tables[p.probe]).length) return null;
  for (const key of Object.keys(p.columns)) {
    if (key === p.probe) continue;
    // A missing optional column (older firmware) just leaves that reading blank.
    try { tables[key] = await walkColumn(session, p.columns[key]); } catch (e) { tables[key] = {}; }
  }
  return p.parse(tables).slice(0, MAX_ONUS);
}

function get(session, oid) {
  return new Promise((resolve) => {
    session.get([oid], (err, vbs) => resolve(err || !vbs || snmp.isVarbindError(vbs[0]) ? null : vbs[0].value));
  });
}

// Reads the ONU list. `knownProfile` skips detection. Returns { profile, label, onus } or null
// when the device is not an OLT this reader understands.
async function readOnus({ host, port = 161, community = 'public', version = '2c', timeout = 5000 }, knownProfile) {
  const session = snmp.createSession(host, community || 'public', {
    port, version: version === '1' ? snmp.Version1 : snmp.Version2c, timeout, retries: 1
  });
  session.on('error', () => {});
  try {
    let list;
    if (knownProfile) list = [profile(knownProfile)].filter(Boolean);
    else list = candidates(await get(session, '1.3.6.1.2.1.1.2.0'));
    for (const p of list) {
      let onus;
      try { onus = await readProfile(session, p); } catch (e) { if (knownProfile) throw e; onus = null; }
      if (onus && onus.length) return { profile: p.id, label: p.label, onus };
    }
    return null;
  } finally {
    session.close();
  }
}

module.exports = { readOnus, PROFILES, profile, candidates, isOltObjectId, serial, mac, MAX_ONUS };
