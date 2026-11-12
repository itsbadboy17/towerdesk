// Credential vault (data/credentials.json). The tower owner saves the few logins and SNMP
// communities they use across their gear once; TowerDesk then tries them automatically when a
// device is added, so they never pick a method or type a password per device.
// Passwords and communities are encrypted with storage.encrypt and never returned by list().
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'credentials.json');

function load() {
  try {
    const v = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { logins: Array.isArray(v.logins) ? v.logins : [], communities: Array.isArray(v.communities) ? v.communities : [] };
  } catch (e) {
    return { logins: [], communities: [] };
  }
}

function save(vault) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(vault, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

// What the browser sees: labels and usernames only, never the secret.
function list() {
  const v = load();
  return {
    logins: v.logins.map((l) => ({ id: l.id, label: l.label, username: l.username })),
    communities: v.communities.map((c) => ({ id: c.id, label: c.label }))
  };
}

// Decrypted, for server-side connection attempts only. Never sent to the client.
function resolved() {
  const v = load();
  return {
    logins: v.logins.map((l) => ({ id: l.id, label: l.label, username: l.username, password: l.secret ? storage.decrypt(l.secret) : '' })),
    communities: v.communities.map((c) => ({ id: c.id, label: c.label, community: c.secret ? storage.decrypt(c.secret) : '' }))
  };
}

function addLogin({ label, username, password }) {
  const v = load();
  const entry = {
    id: 'cred-' + crypto.randomBytes(5).toString('hex'),
    label: String(label || username || 'login').trim().slice(0, 60),
    username: String(username || '').trim().slice(0, 64),
    secret: password ? storage.encrypt(String(password)) : null
  };
  v.logins.push(entry);
  save(v);
  return { id: entry.id, label: entry.label, username: entry.username };
}

function addCommunity({ label, community }) {
  const v = load();
  const entry = {
    id: 'comm-' + crypto.randomBytes(5).toString('hex'),
    label: String(label || community || 'community').trim().slice(0, 60),
    secret: community ? storage.encrypt(String(community)) : null
  };
  v.communities.push(entry);
  save(v);
  return { id: entry.id, label: entry.label };
}

function remove(id) {
  const v = load();
  const before = v.logins.length + v.communities.length;
  v.logins = v.logins.filter((l) => l.id !== id);
  v.communities = v.communities.filter((c) => c.id !== id);
  if (v.logins.length + v.communities.length === before) return false;
  save(v);
  return true;
}

module.exports = { list, resolved, addLogin, addCommunity, remove };
