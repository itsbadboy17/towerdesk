// Saved devices (data/devices.json). Passwords and SNMP communities are encrypted with
// storage.encrypt and never returned by publicView().
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'devices.json');
const TYPES = ['mikrotik', 'cisco', 'switch', 'ubnt', 'mimosa', 'tplink', 'onu', 'olt', 'other'];

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

function publicView(d) {
  const { secret, communitySecret, ...rest } = d;
  return { ...rest, hasPassword: !!secret, hasCommunity: !!communitySecret };
}

function list() {
  return load().map(publicView);
}

function get(id) {
  return load().find((d) => d.id === id) || null;
}

// Connection options for a saved device, with secrets decrypted (server-side use only).
// An existing device with the same address and connection method, if any.
function findDuplicate(input) {
  const ip = String(input.ip || '').trim().toLowerCase();
  const method = input.method || 'ping';
  const port = input.port ? Number(input.port) : null;
  const d = load().find((x) => x.ip.toLowerCase() === ip && x.method === method && (x.port || null) === port);
  return d ? publicView(d) : null;
}

function connectionOptions(d) {
  return {
    host: d.ip,
    type: d.type,
    method: d.method,
    port: d.port,
    username: d.username,
    password: d.secret ? storage.decrypt(d.secret) : undefined,
    community: d.communitySecret ? storage.decrypt(d.communitySecret) : undefined
  };
}

function add(input, lastTest) {
  const devices = load();
  const device = {
    id: 'dev-' + crypto.randomBytes(6).toString('hex'),
    name: String(input.name).trim().slice(0, 80),
    type: TYPES.includes(input.type) ? input.type : 'other',
    ip: String(input.ip).trim(),
    location: String(input.location || '').trim().slice(0, 120),
    method: input.method || 'ping',
    port: input.port ? Number(input.port) : null,
    username: input.username ? String(input.username).slice(0, 64) : '',
    secret: input.password ? storage.encrypt(String(input.password)) : null,
    communitySecret: input.community ? storage.encrypt(String(input.community)) : null,
    createdAt: new Date().toISOString(),
    lastTest: lastTest || null,
    status: lastTest ? { online: !!lastTest.ok, checkedAt: new Date().toISOString() } : null
  };
  devices.push(device);
  save(devices);
  return publicView(device);
}

function update(id, patch) {
  const devices = load();
  const i = devices.findIndex((d) => d.id === id);
  if (i === -1) return null;
  devices[i] = { ...devices[i], ...patch };
  save(devices);
  return publicView(devices[i]);
}

// Switch how a saved device is monitored (e.g. to SNMP after enabling it on the router).
// The community is encrypted at rest; this never touches the stored login.
function reconfigure(id, { method, community, port, lastTest }) {
  const patch = {};
  if (method !== undefined) patch.method = method;
  if (port !== undefined) patch.port = port ? Number(port) : null;
  if (community !== undefined) patch.communitySecret = community ? storage.encrypt(String(community)) : null;
  if (lastTest) {
    patch.lastTest = lastTest;
    patch.status = { online: !!lastTest.ok, checkedAt: new Date().toISOString() };
  }
  return update(id, patch);
}

// General edit from the device detail panel: change name, type, location, monitoring method,
// port, login or SNMP community. An empty password or community means "leave it unchanged",
// so the user can switch methods without re-typing secrets. Secrets are encrypted at rest.
function edit(id, input) {
  const list = load();
  const cur = list.find((d) => d.id === id);
  if (!cur) return null;
  const patch = {};
  if (input.name !== undefined) patch.name = String(input.name).trim().slice(0, 80) || cur.name;
  if (input.type !== undefined) patch.type = TYPES.includes(input.type) ? input.type : cur.type;
  if (input.location !== undefined) patch.location = String(input.location || '').trim().slice(0, 120);
  if (input.provider !== undefined) patch.provider = String(input.provider || '').trim().slice(0, 80) || null;
  if (input.method !== undefined) patch.method = input.method;
  if (input.port !== undefined) patch.port = input.port ? Number(input.port) : null;
  if (input.username !== undefined) patch.username = input.username ? String(input.username).slice(0, 64) : '';
  if (input.password) patch.secret = storage.encrypt(String(input.password));
  if (input.community) patch.communitySecret = storage.encrypt(String(input.community));
  if (input.peerId !== undefined) setPeer(id, input.peerId);
  return update(id, patch);
}

// Pair two saved devices as the two ends of one link (stored on both), or unpair with an empty
// peerId. A device has at most one peer, so any older pairing of either end is cleared. An
// unknown peer or pairing a device with itself is ignored.
function setPeer(id, peerId) {
  const list = load();
  const a = list.find((d) => d.id === id);
  if (!a) return null;
  const b = peerId ? list.find((d) => d.id === peerId) : null;
  if (peerId && (!b || b.id === id)) return publicView(a);
  list.forEach((d) => { if (d.peerId === id || (b && d.peerId === b.id)) d.peerId = null; });
  a.peerId = b ? b.id : null;
  if (b) b.peerId = a.id;
  save(list);
  return publicView(a);
}

function remove(id) {
  const devices = load();
  const next = devices.filter((d) => d.id !== id);
  next.forEach((d) => { if (d.peerId === id) d.peerId = null; if (d.parentId === id) d.parentId = null; });
  if (next.length === devices.length) return false;
  save(next);
  return true;
}

// Where a device sits: which site (free text) and what it connects to (another saved device, or
// 'internet' for the top of the network). Only these two fields; nothing about how the device is
// monitored changes, so no re-test is needed. A device cannot connect to itself or make a loop.
// Returns { device } or { error }.
function setLayout(id, input) {
  const list = load();
  const d = list.find((x) => x.id === id);
  if (!d) return { error: 'Device not found' };
  const inp = input || {};
  if (inp.location !== undefined) d.location = String(inp.location || '').trim().slice(0, 120);
  if (inp.parentId !== undefined) {
    const pid = inp.parentId ? String(inp.parentId) : null;
    if (pid && pid !== 'internet') {
      if (pid === id) return { error: 'A device cannot connect to itself' };
      const p = list.find((x) => x.id === pid);
      if (!p) return { error: 'The device it should connect to is not saved' };
      let cur = p, guard = 0;
      while (cur && guard++ < 100) {
        if (cur.parentId === id) return { error: 'That would make a loop' };
        cur = list.find((x) => x.id === cur.parentId);
      }
    }
    d.parentId = pid;
  }
  save(list);
  return { device: publicView(d) };
}

// A free-text note on a device (where it is, who installed it, what to know on a visit). Never a password.
function setNotes(id, text) {
  const list = load();
  const d = list.find((x) => x.id === id);
  if (!d) return { error: 'Device not found' };
  d.notes = String(text || '').replace(/\r/g, '').trim().slice(0, 1000);
  save(list);
  return { ok: true, notes: d.notes };
}

module.exports = { TYPES, list, get, add, update, edit, setPeer, setLayout, setNotes, reconfigure, remove, connectionOptions, publicView, findDuplicate };
