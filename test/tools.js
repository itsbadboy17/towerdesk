// Tests backup/restore (round-trip, validation, safety copy) and the network tools' host checks.
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-tools-'));
process.env.TOWERDESK_DATA_DIR = tmp;
process.env.TOWERDESK_HISTORY = 'off';

const backup = require('../src/backup');
const tools = require('../src/tools');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}
function throws(fn) { try { fn(); return false; } catch (e) { return true; } }

(async () => {
  // ---- Backup contents ----
  const key = Buffer.from([1, 2, 3, 250, 251, 252]);
  fs.writeFileSync(path.join(tmp, 'devices.json'), JSON.stringify([{ id: 'a', name: 'Sector' }]));
  fs.writeFileSync(path.join(tmp, 'radius.json'), JSON.stringify({ source: 'sas4' }));
  fs.writeFileSync(path.join(tmp, 'secret.key'), key);
  fs.writeFileSync(path.join(tmp, 'history.db'), 'not included');
  fs.mkdirSync(path.join(tmp, 'updates'));
  const b = backup.create('9.9.9');
  ok('backup is labelled', b.app === 'towerdesk' && b.kind === 'backup' && b.version === '9.9.9');
  ok('backup has data files + key', Object.keys(b.files).sort().join() === 'devices.json,radius.json,secret.key');
  ok('backup leaves out history and folders', !('history.db' in b.files) && !('updates' in b.files));

  // ---- Restore round-trip, with a copy of what was replaced ----
  fs.writeFileSync(path.join(tmp, 'devices.json'), JSON.stringify([{ id: 'changed' }]));
  fs.writeFileSync(path.join(tmp, 'secret.key'), 'other-key');
  const r = backup.restore(JSON.parse(JSON.stringify(b)));
  ok('restore reports files', r.restored.length === 3);
  ok('restore brings devices back', JSON.parse(fs.readFileSync(path.join(tmp, 'devices.json'), 'utf8'))[0].id === 'a');
  ok('restore brings the key back byte-for-byte', fs.readFileSync(path.join(tmp, 'secret.key')).equals(key));
  ok('replaced files are kept', JSON.parse(fs.readFileSync(path.join(r.previousKeptIn, 'devices.json'), 'utf8'))[0].id === 'changed');

  // ---- Bad backups are refused and change nothing ----
  ok('rejects a non-backup', throws(() => backup.restore({ hello: 1 })) && throws(() => backup.restore(null)));
  ok('rejects damaged json', throws(() => backup.restore({ app: 'towerdesk', kind: 'backup', files: { 'devices.json': '{oops' } })));
  ok('damaged backup left data intact', JSON.parse(fs.readFileSync(path.join(tmp, 'devices.json'), 'utf8'))[0].id === 'a');
  backup.restore({ app: 'towerdesk', kind: 'backup', files: { 'devices.json': '[]', '../evil.json': '{}', 'sub/x.json': '{}', 'run.cmd': 'x', 'history.db': 'x' } });
  ok('ignores paths and non-data files', !fs.existsSync(path.join(tmp, '..', 'evil.json')) && !fs.existsSync(path.join(tmp, 'run.cmd')) && fs.readFileSync(path.join(tmp, 'history.db'), 'utf8') === 'not included');

  // ---- Network tools: only a plain host name / IP ever reaches the system command ----
  for (const bad of ['', '8.8.8.8 & calc', '10.0.0.1; ls', '-n', '$(whoami)', '10.0.0.1|more', 'a b', '`id`']) {
    const out = await tools.run('ping', bad);
    ok('ping refuses ' + JSON.stringify(bad), out.ok === false && /Invalid/.test(out.error));
  }
  ok('unknown tool refused', (await tools.run('format', '127.0.0.1')).ok === false);
  const p = await tools.run('ping', '127.0.0.1');
  ok('ping localhost returns output', p.ok === true && p.tool === 'ping' && /127\.0\.0\.1/.test(p.output));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Tools and backup tests passed.');
  process.exit(0);
})();
