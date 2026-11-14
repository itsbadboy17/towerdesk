// A short history of what was changed on each radio through TowerDesk (data/radio-history.json):
// every apply, keep, undo and automatic revert, with the values before and after. It is what
// "go back to this" and "apply this again" are built from. Passwords never go in here.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'radio-history.json');
const KEEP = 500;

function load() {
  try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

const ACTIONS = ['applied', 'kept', 'undone', 'expired'];

// entry: { deviceId, deviceName, action, changes: [{ setting, label, unit, from, to }] }
function add(entry) {
  if (!entry || !entry.deviceId || !ACTIONS.includes(entry.action)) return null;
  const rec = {
    t: new Date().toISOString(),
    deviceId: String(entry.deviceId),
    deviceName: String(entry.deviceName || '').slice(0, 80),
    action: entry.action,
    changes: (entry.changes || []).filter((c) => c && ['frequency', 'txPower'].includes(c.setting)).map((c) => ({
      setting: c.setting, label: String(c.label || c.setting).slice(0, 40), unit: String(c.unit || '').slice(0, 8),
      from: Number.isFinite(c.from) ? c.from : null, to: Number.isFinite(c.to) ? c.to : null
    }))
  };
  if (!rec.changes.length) return null;
  const list = load();
  list.unshift(rec);
  if (list.length > KEEP) list.length = KEEP;
  save(list);
  return rec;
}

// Newest first.
function list(deviceId, limit) {
  return load().filter((e) => e.deviceId === deviceId).slice(0, limit || 30);
}
function find(deviceId, t) {
  return load().find((e) => e.deviceId === deviceId && e.t === t) || null;
}
function forget(deviceId) {
  const list = load();
  const next = list.filter((e) => e.deviceId !== deviceId);
  if (next.length !== list.length) save(next);
}

module.exports = { add, list, find, forget, ACTIONS };
