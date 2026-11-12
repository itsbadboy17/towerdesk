// Tests the RADIUS/SAS subscribers module: demo shape, summary math, and config round-trip.
// Uses a temporary data dir so it never touches a real install's saved settings.
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-subs-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const subs = require('../src/subscribers');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}

(async function () {
  // Demo source returns a populated, well-shaped list with a consistent summary.
  const demo = await subs.list({ demo: true });
  ok('demo source', demo.source === 'demo' && demo.configured === true);
  ok('demo has subscribers', Array.isArray(demo.subscribers) && demo.subscribers.length === 24);

  const s = demo.subscribers[0];
  ['id', 'username', 'name', 'plan', 'online', 'nas', 'sessionText', 'bytesDown', 'bytesUp'].forEach(function (k) {
    ok('field ' + k, Object.prototype.hasOwnProperty.call(s, k));
  });

  // Summary totals agree with the rows.
  const online = demo.subscribers.filter(function (x) { return x.online; }).length;
  ok('summary total', demo.summary.total === 24);
  ok('summary online', demo.summary.online === online);
  ok('summary offline', demo.summary.offline === 24 - online);
  ok('summary down bps >= 0', demo.summary.liveDownBps >= 0);

  // Offline subscribers carry no live rate and no session.
  const off = demo.subscribers.find(function (x) { return !x.online; });
  ok('offline exists (South sector)', !!off);
  ok('offline no live rate', off.liveDownBps === 0 && off.liveUpBps === 0);

  // Unconfigured install returns an empty, un-configured result (not demo).
  const none = await subs.list({});
  ok('unconfigured source none', none.source === 'none' && none.configured === false);
  ok('unconfigured empty', none.subscribers.length === 0);

  // Config round-trip: secret is stored but never returned in the public view.
  const saved = subs.setConfig({ source: 'mikrotik', host: '10.90.0.1', username: 'admin', password: 'sw0rdfish', nas: 'Core NAS' });
  ok('config saved source', saved.source === 'mikrotik');
  ok('config host', saved.host === '10.90.0.1');
  ok('config hides secret', saved.hasSecret === true && saved.secret === undefined);

  const got = subs.getConfig();
  ok('config persisted', got.host === '10.90.0.1' && got.nas === 'Core NAS');

  // After saving a non-demo source, list() tries it (mikrotik unreachable here) and degrades
  // gracefully to an empty list with a note, never throwing.
  const mt = await subs.list({});
  ok('mikrotik degrades', mt.source === 'mikrotik' && mt.subscribers.length === 0 && typeof mt.note === 'string');

  // Disconnecting: 'none' is a valid source so the operator can clear the server.
  const off2 = subs.setConfig({ source: 'none' });
  ok('can disconnect', off2.source === 'none');
  const afterOff = await subs.list({});
  ok('disconnected is empty', afterOff.source === 'none' && afterOff.configured === false);

  console.log('Subscribers module tests passed.');
})();
