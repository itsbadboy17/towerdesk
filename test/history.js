// Tests the SQLite history store: it records samples, reads them back, computes uptime, and —
// the whole point — keeps the data across a close/reopen (i.e. a server restart). Uses a temp dir.
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-hist-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const history = require('../src/history');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}

ok('history enabled (node:sqlite)', history.enabled() === true);

// Record a run of samples for two devices.
for (let i = 0; i < 10; i++) {
  history.record('dev-a', { online: true, latencyMs: 3 + i, rxBps: 1000000 + i * 1000, txBps: 200000, cpu: 20 + i });
}
history.record('dev-a', { online: false, latencyMs: null, rxBps: null, txBps: null, cpu: null });
history.record('dev-b', { online: true, latencyMs: 9, rxBps: 5, txBps: 5, cpu: 50 });

ok('count dev-a', history.count('dev-a') === 11);
ok('count total', history.count() === 12);

const rec = history.recent('dev-a', 5);
ok('recent returns oldest-first', rec.length === 5 && rec[0].t <= rec[4].t);
ok('recent carries latency + rx', rec[0].ms !== undefined && rec[rec.length - 1].online === false);

// Uptime: 10 online + 1 offline over the last day = 10/11.
const up = history.uptimePct('dev-a', 24 * 3600 * 1000);
ok('uptime ~90.9%', up === Math.round((10 / 11) * 1000) / 10);

// Simulate a restart: close the DB handle, then reopen and confirm the data is still there.
history.close();
ok('persists across restart (count)', history.count('dev-a') === 11);
const rec2 = history.recent('dev-a', 60);
ok('persists across restart (recent)', rec2.length === 11 && rec2[0].ms === 3);

// forget() drops one device only.
history.forget('dev-b');
ok('forget dev-b', history.count('dev-b') === 0 && history.count('dev-a') === 11);

// prune(keepIds) removes samples for devices not in the list.
history.record('dev-c', { online: true, latencyMs: 1 });
history.prune(['dev-a']);
ok('prune keeps only listed devices', history.count('dev-c') === 0 && history.count('dev-a') === 11);

// Customer-radio history: one sample per radio per interval, looked up by MAC in any format.
const sta = [{ mac: 'AA:BB:CC:00:00:01', signal: -61, ccq: 93, rxBps: 1000, txBps: 2000 }, { mac: 'AA:BB:CC:00:00:02', signal: -70, ccq: 80 }, { mac: 'bad' }];
ok('stations stored once each', history.recordStations('sec-1', sta) === 2);
ok('repeat within the interval is skipped', history.recordStations('sec-1', sta) === 0);
const sh = history.stationHistory('aa-bb-cc-00-00-01');
ok('station history by MAC', sh.length === 1 && sh[0].signal === -61 && sh[0].ccq === 93 && sh[0].tx === 2000);
ok('unknown radio has no history', history.stationHistory('AA:BB:CC:00:00:99').length === 0 && history.stationHistory('nope').length === 0);
history.close();
ok('station history persists across restart', history.stationHistory('AA:BB:CC:00:00:02')[0].signal === -70);

history.close();
console.log('History store tests passed.');
