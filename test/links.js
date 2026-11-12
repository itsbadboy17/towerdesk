// Tests link pairing (both ends managed vs slave only), the saved pairing on devices, and that
// the demo sector registration table carries MACs that match the demo SAS sessions.
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-links-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const { pairLinks } = require('../src/links');
const devices = require('../src/devices');
const demo = require('../src/demo');
const subscribers = require('../src/subscribers');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}
const bh = (id, name, radio, peerId) => ({ id, name, role: 'backhaul', peerId: peerId || null, metrics: { radio: radio || {} } });

// Explicit pairing is kept only when it is mutual and the peer exists.
let l = pairLinks([bh('a', 'A', {}, 'b'), bh('b', 'B', {}, 'a')]);
ok('explicit mutual pair kept', l[0].peerId === 'b' && l[1].peerId === 'a' && !l[0].peerAuto);
l = pairLinks([bh('a', 'A', {}, 'gone')]);
ok('pair to missing device dropped', l[0].peerId === null);
l = pairLinks([bh('a', 'A', {}, 'b'), bh('b', 'B', {})]);
ok('one-sided pair dropped', l[0].peerId === null && l[1].peerId === null);

// Auto pairing: same link name, or one end names the other as its remote.
l = pairLinks([bh('a', 'Tower', { linkName: 'North-Link' }), bh('b', 'Core', { linkName: 'north-link' })]);
ok('auto pair by link name', l[0].peerId === 'b' && l[1].peerId === 'a' && l[0].peerAuto === true);
l = pairLinks([bh('a', 'Tower', { remoteName: 'Core POP' }), bh('b', 'core pop', {})]);
ok('auto pair by remote name', l[0].peerId === 'b' && l[1].peerId === 'a');

// Slave only: nothing to pair with, and non-links are never paired.
l = pairLinks([bh('a', 'Tower', { linkName: 'x', remoteName: 'Far' }), { id: 's', name: 'Far', role: 'sector', metrics: { radio: { linkName: 'x' } } }]);
ok('slave-only link stays unpaired', l[0].peerId === null && !l[1].peerId);
l = pairLinks([bh('a', 'A', { linkName: 'x' }), bh('b', 'B', { linkName: 'x' }), bh('c', 'C', { linkName: 'x' })]);
ok('a device has at most one peer', l[0].peerId === 'b' && l[2].peerId === null);

// Saved pairing: stored on both ends, re-pairing clears the old peer, removal unpairs.
const mk = (name, ip) => devices.add({ name, type: 'ubnt', ip, method: 'ping' }).id;
const A = mk('A', '10.0.0.1'), B = mk('B', '10.0.0.2'), C = mk('C', '10.0.0.3');
devices.edit(A, { peerId: B });
ok('pair saved on both ends', devices.get(A).peerId === B && devices.get(B).peerId === A);
devices.edit(A, { peerId: C });
ok('re-pair clears old peer', devices.get(A).peerId === C && devices.get(C).peerId === A && !devices.get(B).peerId);
devices.edit(A, { peerId: A });
ok('cannot pair with itself', devices.get(A).peerId === C);
devices.edit(A, { peerId: 'nope' });
ok('unknown peer ignored', devices.get(A).peerId === C);
devices.edit(A, { location: 'Roof' });
ok('edit without peerId keeps pair', devices.get(A).peerId === C);
devices.remove(C);
ok('removing a device unpairs its peer', !devices.get(A).peerId);
devices.edit(A, { peerId: B }); devices.edit(A, { peerId: '' });
ok('empty peerId unpairs both', !devices.get(A).peerId && !devices.get(B).peerId);

// Demo: one link with both ends, one with the slave only.
const snap = demo.snapshot();
const by = (id) => snap.devices.find((d) => d.id === id);
ok('demo East backhaul has both ends', by('bh2').peerId === 'bh2m' && by('bh2m').peerId === 'bh2');
ok('demo North backhaul is slave only', by('bh1').peerId === null);

// Demo sector registration: every station has a MAC, and all but the spare match a SAS session.
const norm = (m) => String(m).toLowerCase().replace(/[^0-9a-f]/g, '');
const sasMacs = new Set(subscribers._demoSubs(24).map((s) => norm(s.mac)));
const st = by('s1').metrics.stations;
ok('demo sector lists stations with MACs', st.length > 1 && st.every((x) => norm(x.mac).length === 12));
ok('demo station MACs match SAS', st.filter((x) => sasMacs.has(norm(x.mac))).length === st.length - 1);
ok('demo offline sector has no stations', by('s3').metrics.stations.length === 0);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('Link pairing tests passed.');
