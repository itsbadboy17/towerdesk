// Backup and restore of TowerDesk's own data folder: devices, saved logins, alerts, SAS/updater
// settings and the key that unlocks the encrypted passwords. Monitoring history (history.db) and
// staged updates are not included — history is large and rebuilds itself.
//
// A backup is one JSON file. It contains the encryption key next to the encrypted passwords, so
// it must be kept private; the Settings page says so before the download.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

const KEY_FILE = 'secret.key';
const MAX_FILE = 5 * 1024 * 1024;
const isDataFile = (name) => /^[a-z0-9][a-z0-9_-]*\.json$/i.test(name) || name === KEY_FILE;

function create(version) {
  const dir = dataDir();
  const files = {};
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { /* empty install */ }
  names.filter(isDataFile).forEach((name) => {
    const p = path.join(dir, name);
    try {
      if (!fs.statSync(p).isFile()) return;
      files[name] = name === KEY_FILE ? fs.readFileSync(p).toString('base64') : fs.readFileSync(p, 'utf8');
    } catch (e) { /* skip unreadable */ }
  });
  return { app: 'towerdesk', kind: 'backup', version: version || '', createdAt: new Date().toISOString(), files };
}

// Validates a backup, keeps a copy of the files it is about to replace (data/before-restore/…),
// then writes the backup's files. Throws an Error with a user-safe message on a bad backup.
function restore(bundle) {
  if (!bundle || bundle.app !== 'towerdesk' || bundle.kind !== 'backup' || !bundle.files || typeof bundle.files !== 'object') {
    throw new Error('This file is not a TowerDesk backup.');
  }
  const entries = Object.entries(bundle.files).filter(([name, body]) => isDataFile(name) && typeof body === 'string' && body.length <= MAX_FILE);
  if (!entries.length) throw new Error('The backup contains no data.');
  entries.forEach(([name, body]) => {
    if (name !== KEY_FILE) { try { JSON.parse(body); } catch (e) { throw new Error('The backup is damaged (' + name + ' is not valid).'); } }
  });
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const keep = path.join(dir, 'before-restore', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(keep, { recursive: true });
  entries.forEach(([name]) => {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(keep, name));
  });
  entries.forEach(([name, body]) => {
    const tmp = path.join(dir, name + '.tmp');
    fs.writeFileSync(tmp, name === KEY_FILE ? Buffer.from(body, 'base64') : body, { mode: 0o600 });
    fs.renameSync(tmp, path.join(dir, name));
  });
  return { restored: entries.map(([name]) => name), previousKeptIn: keep };
}

module.exports = { create, restore, isDataFile };
