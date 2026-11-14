// Maintenance windows (data/maintenance.json): while a device or a whole site is in maintenance, TowerDesk
// raises no alerts and sends no messages for it. A window ends by itself at its end time.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'maintenance.json');
const MAX_HOURS = 72;

function load() { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}
function siteKey(s) { return String(s || '').trim().toLowerCase(); }

// Windows that have not ended yet (expired ones are dropped from the file as a side effect).
function active(now) {
  now = now || Date.now();
  const all = load();
  const live = all.filter((w) => Date.parse(w.until) > now);
  if (live.length !== all.length) save(live);
  return live;
}

// { scope: 'device'|'site', id | site, hours, reason, by }
function add(w, now) {
  now = now || Date.now();
  const scope = w && w.scope === 'site' ? 'site' : 'device';
  const asked = Number(w && w.hours);
  if (!(asked > 0)) return { error: 'Choose how long the maintenance lasts.' };
  const hours = Math.min(MAX_HOURS, Math.max(0.25, asked));
  if (scope === 'device' && !(w && w.id)) return { error: 'Choose a device.' };
  if (scope === 'site' && !siteKey(w && w.site)) return { error: 'Choose a site.' };
  const rec = {
    id: 'mnt-' + crypto.randomBytes(4).toString('hex'),
    scope,
    targetId: scope === 'device' ? String(w.id) : null,
    site: scope === 'site' ? String(w.site).trim().slice(0, 120) : null,
    name: String(w.name || (scope === 'site' ? w.site : w.id)).slice(0, 120),
    reason: String(w.reason || '').slice(0, 200),
    by: String(w.by || '').slice(0, 64),
    at: new Date(now).toISOString(),
    until: new Date(now + hours * 3600 * 1000).toISOString()
  };
  const list = active(now);
  list.unshift(rec);
  save(list);
  return { ok: true, window: rec };
}

function remove(id) {
  const list = load();
  const next = list.filter((w) => w.id !== id);
  if (next.length === list.length) return false;
  save(next);
  return true;
}

// The window that covers this device (its own, or its site's), or null.
function isMuted(device, now) {
  if (!device) return null;
  const list = active(now);
  if (!list.length) return null;
  const site = siteKey(device.location);
  return list.find((w) => (w.scope === 'device' && w.targetId === device.id) || (w.scope === 'site' && site && siteKey(w.site) === site)) || null;
}

module.exports = { add, remove, active, isMuted, MAX_HOURS };
