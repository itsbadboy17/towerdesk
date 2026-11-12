// Alerts raised by the live monitor: device offline (critical) and sustained high latency
// (warning). Alerts close automatically when the condition clears. Stored in data/alerts.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'alerts.json');
const KEEP_RESOLVED = 200;
const LATENCY_WARN_MS = Number(process.env.TOWERDESK_LATENCY_WARN_MS) || 200;

let alerts = null;

function load() {
  if (alerts) return alerts;
  try {
    alerts = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    alerts = [];
  }
  return alerts;
}

function save() {
  const list = load();
  // Keep every open alert plus the most recent resolved ones.
  const open = list.filter((a) => !a.resolvedAt);
  const resolved = list.filter((a) => a.resolvedAt).slice(0, KEEP_RESOLVED);
  alerts = open.concat(resolved).sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(alerts, null, 2));
  fs.renameSync(tmp, FILE);
}

function findOpen(deviceId, kind) {
  return load().find((a) => a.deviceId === deviceId && a.kind === kind && !a.resolvedAt);
}

function open(device, kind, severity, message) {
  if (findOpen(device.id, kind)) return null;
  const a = {
    id: 'alr-' + crypto.randomBytes(5).toString('hex'),
    deviceId: device.id,
    deviceName: device.name,
    ip: device.ip,
    kind,
    severity,
    message,
    openedAt: new Date().toISOString(),
    resolvedAt: null,
    acknowledgedAt: null
  };
  load().unshift(a);
  save();
  return a;
}

function resolve(deviceId, kind, note) {
  const a = findOpen(deviceId, kind);
  if (!a) return null;
  a.resolvedAt = new Date().toISOString();
  if (note) a.resolution = note;
  save();
  return a;
}

// Called by the monitor after each check of a device.
function evaluate(device, { online, recentLatencies }) {
  if (online === false) {
    open(device, 'offline', 'critical', `${device.name} (${device.ip}) is not responding`);
    resolve(device.id, 'latency'); // latency is meaningless while down
    return;
  }
  if (online === true) {
    resolve(device.id, 'offline', 'Device responded again');
    const vals = (recentLatencies || []).filter((v) => v !== null);
    if (vals.length >= 3) {
      const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
      if (avg >= LATENCY_WARN_MS) open(device, 'latency', 'warning', `${device.name} latency is high (${Math.round(avg)} ms average)`);
      else if (avg < LATENCY_WARN_MS * 0.75) resolve(device.id, 'latency', 'Latency back to normal');
    }
  }
}

// Device removed from TowerDesk: close its alerts.
function forgetDevice(deviceId) {
  let changed = false;
  for (const a of load()) {
    if (a.deviceId === deviceId && !a.resolvedAt) {
      a.resolvedAt = new Date().toISOString();
      a.resolution = 'Device removed';
      changed = true;
    }
  }
  if (changed) save();
}

function acknowledge(id) {
  const a = load().find((x) => x.id === id);
  if (!a) return null;
  if (!a.acknowledgedAt) {
    a.acknowledgedAt = new Date().toISOString();
    save();
  }
  return a;
}

function list() {
  return load().slice(0, 100);
}

function summary() {
  const openList = load().filter((a) => !a.resolvedAt);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  return {
    active: openList.length,
    unacknowledged: openList.filter((a) => !a.acknowledgedAt).length,
    critical: openList.filter((a) => a.severity === 'critical').length,
    warning: openList.filter((a) => a.severity === 'warning').length,
    resolved24h: load().filter((a) => a.resolvedAt && new Date(a.resolvedAt).getTime() > dayAgo).length,
    latest: openList[0] ? { id: openList[0].id, severity: openList[0].severity, message: openList[0].message, openedAt: openList[0].openedAt } : null
  };
}

module.exports = { evaluate, forgetDevice, acknowledge, list, summary, LATENCY_WARN_MS };
