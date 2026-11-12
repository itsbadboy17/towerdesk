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

// Private-repo token: encrypted at rest, never returned, kept on a blank save, removable.
const FAKE = 'test-token-not-real-123';
const withTok = upd.setConfig({ repo: 'me/towerdesk', channel: 'prerelease', token: FAKE });
ok('token flagged, not returned', withTok.hasToken === true && withTok.token === undefined);
const raw = fs.readFileSync(path.join(tmp, 'update.json'), 'utf8');
ok('token encrypted at rest', raw.indexOf(FAKE) === -1 && JSON.parse(raw).token);
ok('status hides token', JSON.stringify(upd.status()).indexOf(FAKE) === -1);
ok('blank save keeps token', upd.setConfig({ repo: 'me/towerdesk', channel: 'prerelease' }).hasToken === true);

// The token only ever goes to GitHub's API over HTTPS.
ok('token sent to github api', upd.requestHeaders('https://api.github.com/repos/a/b/releases/latest', FAKE).Authorization === 'Bearer ' + FAKE);
ok('token not sent elsewhere', !upd.requestHeaders('https://example.com/latest.json', FAKE).Authorization);
ok('token not sent to lookalike host', !upd.requestHeaders('https://api.github.com.evil.test/x', FAKE).Authorization);
ok('token not sent over http', !upd.requestHeaders('http://api.github.com/x', FAKE).Authorization);
ok('no token, no auth header', !upd.requestHeaders('https://api.github.com/x', '').Authorization);

// Private repos download a release asset through its API URL, or the zipball.
const relPriv = upd.describeRelease({
  tag_name: 'v1.6.0', zipball_url: 'https://api.github.com/repos/a/b/zipball/v1.6.0',
  assets: [{ name: 'TowerDesk-portable.zip', browser_download_url: 'https://x/p.zip', url: 'https://api.github.com/repos/a/b/releases/assets/7' }]
});
ok('private url uses asset api url', relPriv.privateUrl === 'https://api.github.com/repos/a/b/releases/assets/7' && relPriv.downloadUrl === 'https://x/p.zip');
ok('private url falls back to zipball', relZipball.privateUrl === 'https://x/zipball');

ok('token removable', upd.setConfig({ repo: 'me/towerdesk', channel: 'prerelease', clearToken: true }).hasToken === false);

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

// The portable build's layout (TowerDesk\app\... beside node\ and launchers) stages the app only.
const portable = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-portable-'));
const pApp = path.join(portable, 'TowerDesk', 'app');
fs.mkdirSync(pApp, { recursive: true });
fs.mkdirSync(path.join(portable, 'TowerDesk', 'node'));
fs.writeFileSync(path.join(portable, 'TowerDesk', 'node', 'node.exe'), 'x');
fs.writeFileSync(path.join(portable, 'TowerDesk', 'TowerDesk.cmd'), 'x');
fs.writeFileSync(path.join(pApp, 'package.json'), JSON.stringify({ name: 'towerdesk', version: '8.8.8' }));
fs.writeFileSync(path.join(pApp, 'server.js'), '// portable server');
ok('portable layout stages', upd.stageFromDir(portable).version === '8.8.8');
ok('portable stages app files', fs.readFileSync(path.join(upd.STAGED_DIR, 'server.js'), 'utf8') === '// portable server');
ok('portable skips runtime + launcher', !fs.existsSync(path.join(upd.STAGED_DIR, 'node')) && !fs.existsSync(path.join(upd.STAGED_DIR, 'TowerDesk.cmd')));

// clearStaged removes the staged tree + marker.
upd.clearStaged();
ok('clearStaged', upd.pending() === null && !fs.existsSync(upd.STAGED_DIR));

// status() surfaces current version + config + no staged update.
const st = upd.status();
ok('status shape', st.current && st.config.repo === 'me/towerdesk' && st.staged === null);

console.log('Updater tests passed.');
