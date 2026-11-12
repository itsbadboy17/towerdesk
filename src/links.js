// Pairs the two ends of a point-to-point link in a monitor snapshot, so the dashboard can show
// one link with live data from both radios when both are managed — and fall back to the single
// managed end (usually the slave at the tower) when only one is.
//
// Pure: takes the snapshot's device list and sets `peerId` (and `peerAuto` when it was inferred)
// on each paired device. An explicit pairing saved on the device wins; otherwise two unpaired
// backhaul radios are matched when they report the same link name, or when one names the other
// as its remote end.

function norm(v) { return String(v || '').trim().toLowerCase(); }

function pairLinks(list) {
  const byId = new Map(list.map((d) => [d.id, d]));
  // Keep only explicit pairings that are valid and mutual.
  list.forEach((d) => {
    const p = d.peerId ? byId.get(d.peerId) : null;
    if (!p || p.id === d.id || p.peerId !== d.id) d.peerId = null;
  });
  const free = list.filter((d) => d.role === 'backhaul' && !d.peerId);
  const radio = (d) => (d.metrics && d.metrics.radio) || {};
  const matches = (a, b) => {
    const ra = radio(a), rb = radio(b);
    if (norm(ra.linkName) && norm(ra.linkName) === norm(rb.linkName)) return true;
    return (norm(ra.remoteName) && norm(ra.remoteName) === norm(b.name)) ||
      (norm(rb.remoteName) && norm(rb.remoteName) === norm(a.name));
  };
  for (let i = 0; i < free.length; i++) {
    const a = free[i];
    if (a.peerId) continue;
    const b = free.slice(i + 1).find((x) => !x.peerId && matches(a, x));
    if (b) { a.peerId = b.id; b.peerId = a.id; a.peerAuto = true; b.peerAuto = true; }
  }
  return list;
}

module.exports = { pairLinks };
