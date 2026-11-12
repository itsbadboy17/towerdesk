// Persistent monitoring history (data/history.db) using Node's built-in SQLite — no dependency
// added, and nothing to compile, so the portable build stays self-contained. Each poll records
// one sample per device (online, latency, rx/tx, cpu). On restart the monitor reseeds its live
// sparklines from here, so traffic/uptime history survives a restart instead of starting empty.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

// node:sqlite is still flagged experimental on Node 22/23; silence just that one warning so it
// doesn't clutter the server log / test output. Everything else warns as usual.
let DatabaseSync;
(function () {
  const orig = process.emitWarning;
  process.emitWarning = function (w, ...rest) {
    if (String(w).indexOf('SQLite is an experimental') !== -1) return;
    return orig.call(process, w, ...rest);
  };
  try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
  } catch (e) {
    DatabaseSync = null; // very old Node: history silently disabled, app still runs
  } finally {
    process.emitWarning = orig;
  }
})();

const RETENTION_MS = Number(process.env.TOWERDESK_HISTORY_MS) || 7 * 24 * 3600 * 1000; // 7 days
let db = null;
let ready = false;

function open() {
  if (ready) return db;
  ready = true;
  if (!DatabaseSync || process.env.TOWERDESK_HISTORY === 'off') return null;
  try {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(path.join(dir, 'history.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(
      'CREATE TABLE IF NOT EXISTS samples (' +
      ' device_id TEXT NOT NULL, t INTEGER NOT NULL, online INTEGER,' +
      ' latency REAL, rx INTEGER, tx INTEGER, cpu REAL);'
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_samples_dev_t ON samples (device_id, t);');
  } catch (e) {
    db = null;
  }
  return db;
}

function enabled() { return !!open(); }

function n(v) { return v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v); }

// Record one poll result for a device. Never throws — history is best-effort.
function record(deviceId, s) {
  const d = open();
  if (!d || !deviceId) return;
  try {
    d.prepare('INSERT INTO samples (device_id, t, online, latency, rx, tx, cpu) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(String(deviceId), Date.now(), s.online ? 1 : 0, n(s.latencyMs), n(s.rxBps), n(s.txBps), n(s.cpu));
  } catch (e) { /* best-effort */ }
}

// The most recent `limit` samples for a device, oldest-first (for seeding live sparklines).
function recent(deviceId, limit) {
  const d = open();
  if (!d || !deviceId) return [];
  try {
    const rows = d.prepare(
      'SELECT t, online, latency, rx, tx, cpu FROM samples WHERE device_id = ? ORDER BY t DESC LIMIT ?'
    ).all(String(deviceId), Math.max(1, limit || 60));
    return rows.reverse().map((r) => ({
      t: Number(r.t),
      online: r.online === 1,
      ms: r.latency === null ? null : Number(r.latency),
      rx: r.rx === null ? null : Number(r.rx),
      tx: r.tx === null ? null : Number(r.tx),
      cpu: r.cpu === null ? null : Number(r.cpu)
    }));
  } catch (e) { return []; }
}

// Uptime percentage over the last `windowMs` (default 24h) for a device.
function uptimePct(deviceId, windowMs) {
  const d = open();
  if (!d || !deviceId) return null;
  try {
    const since = Date.now() - (windowMs || 24 * 3600 * 1000);
    const row = d.prepare(
      'SELECT COUNT(*) AS total, SUM(online) AS up FROM samples WHERE device_id = ? AND t >= ?'
    ).get(String(deviceId), since);
    if (!row || !row.total) return null;
    return Math.round((Number(row.up || 0) / Number(row.total)) * 1000) / 10;
  } catch (e) { return null; }
}

// Count of samples kept for a device (used by tests / diagnostics).
function count(deviceId) {
  const d = open();
  if (!d) return 0;
  try {
    const row = deviceId
      ? d.prepare('SELECT COUNT(*) AS c FROM samples WHERE device_id = ?').get(String(deviceId))
      : d.prepare('SELECT COUNT(*) AS c FROM samples').get();
    return Number(row.c || 0);
  } catch (e) { return 0; }
}

// Drop samples older than the retention window, and any for devices no longer monitored.
function prune(keepIds) {
  const d = open();
  if (!d) return;
  try {
    d.prepare('DELETE FROM samples WHERE t < ?').run(Date.now() - RETENTION_MS);
    if (Array.isArray(keepIds) && keepIds.length) {
      const placeholders = keepIds.map(() => '?').join(',');
      d.prepare('DELETE FROM samples WHERE device_id NOT IN (' + placeholders + ')').run(...keepIds.map(String));
    }
  } catch (e) { /* best-effort */ }
}

function forget(deviceId) {
  const d = open();
  if (!d || !deviceId) return;
  try { d.prepare('DELETE FROM samples WHERE device_id = ?').run(String(deviceId)); } catch (e) { /* ignore */ }
}

function close() {
  if (db) { try { db.close(); } catch (e) { /* ignore */ } db = null; ready = false; }
}

module.exports = { enabled, record, recent, uptimePct, count, prune, forget, close, RETENTION_MS };
