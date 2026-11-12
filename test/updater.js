// Tests the self-updater's pure logic with no network: version compare, GitHub-release parsing,
// config round-trip, and staging an already-extracted bundle (incl. the nested-folder zipball
// case and the "not TowerDesk" / "smuggled data/" guards). Uses a temp data dir.
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-upd-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const upd = require('../src/updater');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}

// Version compare.
ok('isNewer patch', upd.isNewer('0.1.1', '0.1.0') === true);
ok('isNewer minor', upd.isNewer('0.2.0', '0.1.9') === true);
ok('isNewer equal', upd.isNewer('1.0.0', '1.0.0') === false);
ok('isNewer older', upd.isNewer('0.9.0', '1.0.0') === false);
ok('parseVer tolerant', upd.parseVer('v2.3.4-beta').join('.') === '2.3.4');

// GitHub release parsing: prefers a .zip asset, falls back to the source zipball.
const relAsset = upd.describeRelease({
  tag_name: 'v1.4.0', body: 'Notes here', html_url: 'https://x/rel',
  assets: [{ name: 'TowerDesk-portable.zip', browser_download_url: 'https://x/portable.zip' }],
  zipball_url: 'https://x/zipball'
});
ok('describe version', relAsset.version === '1.4.0');
ok('describe prefers zip asset', relAsset.downloadUrl === 'https://x/portable.zip');

const relZipball = upd.describeRelease({ tag_name: '1.5.0', assets: [], zipball_url: 'https://x/zipball' });
ok('describe falls back to zipball', relZipball.downloadUrl === 'https://x/zipball');

// Config round-trip.
const saved = upd.setConfig({ repo: 'me/towerdesk', channel: 'prerelease' });
ok('config repo', saved.repo === 'me/towerdesk' && saved.channel === 'prerelease');
ok('config persisted', upd.getConfig().repo === 'me/towerdesk');

// Staging an extracted bundle with a nested folder (like GitHub's zipball layout).
const bundle = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-bundle-'));
const inner = path.join(bundle, 'owner-towerdesk-abc123');
fs.mkdirSync(path.join(inner, 'public'), { recursive: true });
fs.writeFileSync(path.join(inner, 'package.json'), JSON.stringify({ name: 'towerdesk', version: '9.9.9' }));
fs.writeFileSync(path.join(inner, 'server.js'), '// new server');
fs.writeFileSync(path.join(inner, 'public', 'app.css'), 'body{}');
// A bundle must never carry its own data/ over the operator's.
fs.mkdirSync(path.join(inner, 'data'));
fs.writeFileSync(path.join(inner, 'data', 'devices.json'), '[{"evil":true}]');

const marker = upd.stageFromDir(bundle);
ok('stage version', marker.version === '9.9.9' && marker.applied === false);
ok('staged server.js copied', fs.existsSync(path.join(upd.STAGED_DIR, 'server.js')));
ok('staged drops bundle data/', !fs.existsSync(path.join(upd.STAGED_DIR, 'data')));
ok('pending marker written', upd.pending() && upd.pending().version === '9.9.9');

// Reject a bundle that isn't TowerDesk.
const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-bad-'));
fs.writeFileSync(path.join(bad, 'package.json'), JSON.stringify({ name: 'something-else', version: '1.0.0' }));
let threw = false;
try { upd.stageFromDir(bad); } catch (e) { threw = true; }
ok('rejects foreign bundle', threw);

// clearStaged removes the staged tree + marker.
upd.clearStaged();
ok('clearStaged', upd.pending() === null && !fs.existsSync(upd.STAGED_DIR));

// status() surfaces current version + config + no staged update.
const st = upd.status();
ok('status shape', st.current && st.config.repo === 'me/towerdesk' && st.staged === null);

console.log('Updater tests passed.');
