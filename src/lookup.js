// Subscriber lookup: joins RADIUS/SAS sessions to the stations registered on the sectors, so a
// subscriber can be traced to "which sector, which radio, what signal" — and a station to its
// PPPoE user. The join key is the MAC address: when the customer's PPPoE user is dialled on the
// CPE radio itself, the MAC the sector sees is the one SAS records.
//
// Pure: takes the subscriber list and a monitor snapshot's device list.
//
// Matching is exact first. A CPE that dials PPPoE on a different port than its radio reports a
// MAC one step away (last byte ±1), so a second pass accepts that — but only when it is
// unambiguous (exactly one unmatched station is one step from the subscriber, and vice versa),
// because neighbouring radios from one box of CPEs can have consecutive MACs. Such matches are
// flagged `near` so the UI can say so.

function macKey(m) {
  const k = String(m || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  return k.length === 12 ? k : '';
}

function isNear(a, b) {
  if (!a || !b || a === b || a.slice(0, 10) !== b.slice(0, 10)) return false;
  return Math.abs(parseInt(a.slice(10), 16) - parseInt(b.slice(10), 16)) === 1;
}

// Radio stations and OLT ONUs alike. An EPON ONU has a MAC; a GPON ONU only has a serial number,
// so it can be matched by MAC only when its name on the OLT is the customer's PPPoE username.
function nameKey(v) { return String(v || '').trim().toLowerCase(); }
function stationsOf(devices) {
  const out = [];
  (devices || []).forEach((d) => {
    const mx = d.metrics || {};
    (mx.stations || []).forEach((st) => {
      const key = macKey(st.mac);
      if (key) out.push({ uid: d.id + '|' + key, key, sectorId: d.id, sectorName: d.name, st, onu: false });
    });
    (mx.onus || []).forEach((st, i) => {
      const key = macKey(st.mac);
      out.push({ uid: d.id + '|onu|' + (key || st.serial || st.port || i), key, sectorId: d.id, sectorName: d.name, st, onu: true });
    });
  });
  return out;
}

function view(e, near) {
  return {
    sectorId: e.sectorId, sectorName: e.sectorName, name: e.st.name || null, mac: e.st.mac, ip: e.st.ip || null,
    signal: e.st.signal === undefined ? null : e.st.signal, ccq: e.st.ccq === undefined ? null : e.st.ccq,
    txRate: e.st.txRate === undefined ? null : e.st.txRate, rxRate: e.st.rxRate === undefined ? null : e.st.rxRate,
    near: !!near,
    ...(e.onu ? {
      onu: true, serial: e.st.serial || null, port: e.st.port || null, online: e.st.online !== false,
      temp: e.st.temp === undefined ? null : e.st.temp, txPower: e.st.txPower === undefined ? null : e.st.txPower,
      oltRx: e.st.oltRx === undefined ? null : e.st.oltRx, distance: e.st.distance === undefined ? null : e.st.distance
    } : {})
  };
}

// Sets `station` (or null) on every subscriber. Returns { stations, matched, near }.
function attachStations(subscribers, devices) {
  const stations = stationsOf(devices);
  const byKey = new Map();
  stations.forEach((e) => { if (e.key && !byKey.has(e.key)) byKey.set(e.key, e); });
  const used = new Set();
  const subs = subscribers || [];
  subs.forEach((s) => {
    const e = byKey.get(macKey(s.mac));
    s.station = e ? view(e, false) : null;
    if (e) used.add(e.uid);
  });
  const freeStations = stations.filter((e) => e.key && !used.has(e.uid));
  const freeSubs = subs.filter((s) => !s.station && macKey(s.mac));
  let near = 0;
  freeSubs.forEach((s) => {
    const k = macKey(s.mac);
    const cands = freeStations.filter((e) => !used.has(e.uid) && isNear(k, e.key));
    if (cands.length !== 1) return;
    const rivals = freeSubs.filter((o) => !o.station && isNear(macKey(o.mac), cands[0].key));
    if (rivals.length !== 1) return;
    s.station = view(cands[0], true);
    used.add(cands[0].uid);
    near++;
  });
  // Third pass, ONUs only: the ONU is named after the PPPoE username on the OLT. Skipped when
  // two ONUs share a name, since then it identifies neither.
  const byName = new Map();
  stations.filter((e) => e.onu && !used.has(e.uid) && nameKey(e.st.name)).forEach((e) => {
    const k = nameKey(e.st.name);
    byName.set(k, byName.has(k) ? null : e);
  });
  let named = 0;
  subs.forEach((s) => {
    if (s.station) return;
    const e = byName.get(nameKey(s.username));
    if (!e || used.has(e.uid)) return;
    s.station = Object.assign(view(e, false), { byName: true });
    used.add(e.uid);
    named++;
  });
  // The two kinds of mismatch worth a look: a radio on a sector that no SAS user owns (an
  // unknown or unbilled device), and a user who is online with no known radio (connected some
  // other way, or on a sector TowerDesk cannot read stations from).
  // ONUs without a MAC are left out: they cannot be matched this way, so listing them is noise.
  const unmatchedStations = stations.filter((e) => e.key && !used.has(e.uid)).map((e) => view(e, false));
  const usersWithoutRadio = subs.filter((s) => s.online && !s.station).length;
  return { stations: stations.length, matched: subs.filter((s) => s.station).length, near, named, unmatchedStations, usersWithoutRadio };
}

module.exports = { attachStations, macKey, isNear };
