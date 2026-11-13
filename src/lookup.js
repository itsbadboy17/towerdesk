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

function stationsOf(devices) {
  const out = [];
  (devices || []).forEach((d) => {
    const list = (d.metrics && d.metrics.stations) || [];
    list.forEach((st) => {
      const key = macKey(st.mac);
      if (key) out.push({ key, sectorId: d.id, sectorName: d.name, st });
    });
  });
  return out;
}

function view(e, near) {
  return {
    sectorId: e.sectorId, sectorName: e.sectorName, name: e.st.name || null, mac: e.st.mac, ip: e.st.ip || null,
    signal: e.st.signal === undefined ? null : e.st.signal, ccq: e.st.ccq === undefined ? null : e.st.ccq,
    txRate: e.st.txRate === undefined ? null : e.st.txRate, rxRate: e.st.rxRate === undefined ? null : e.st.rxRate,
    near: !!near
  };
}

// Sets `station` (or null) on every subscriber. Returns { stations, matched, near }.
function attachStations(subscribers, devices) {
  const stations = stationsOf(devices);
  const byKey = new Map();
  stations.forEach((e) => { if (!byKey.has(e.key)) byKey.set(e.key, e); });
  const used = new Set();
  const subs = subscribers || [];
  subs.forEach((s) => {
    const e = byKey.get(macKey(s.mac));
    s.station = e ? view(e, false) : null;
    if (e) used.add(e.key);
  });
  const freeStations = stations.filter((e) => !used.has(e.key));
  const freeSubs = subs.filter((s) => !s.station && macKey(s.mac));
  let near = 0;
  freeSubs.forEach((s) => {
    const k = macKey(s.mac);
    const cands = freeStations.filter((e) => !used.has(e.key) && isNear(k, e.key));
    if (cands.length !== 1) return;
    const rivals = freeSubs.filter((o) => !o.station && isNear(macKey(o.mac), cands[0].key));
    if (rivals.length !== 1) return;
    s.station = view(cands[0], true);
    used.add(cands[0].key);
    near++;
  });
  return { stations: stations.length, matched: subs.filter((s) => s.station).length, near };
}

module.exports = { attachStations, macKey, isNear };
