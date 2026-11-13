// RADIUS / SAS subscribers. A tower owner authenticates customers against a RADIUS server
// (FreeRADIUS, MikroTik User-Manager) or a SAS. This module normalises whatever the source
// reports into one subscriber-session shape the UI can render, and ships a deterministic demo
// source so the page works offline / in the portable trial build.
//
// Normalised subscriber session:
//   { id, username, name, plan, rateDown, rateUp (Mbps), online, framedIp, mac, nas,
//     sessionStart (iso), sessionSeconds, bytesDown, bytesUp, liveDownBps, liveUpBps,
//     signal (dBm|null), lastSeen (iso) }
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'radius.json');
const SOURCES = ['demo', 'sas4', 'mikrotik', 'freeradius'];

// ---- Config (data/radius.json). The server secret is encrypted at rest, never returned. ----
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return { source: 'none' };
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
// Public view: no secret, just whether one is saved.
function getConfig() {
  const c = loadConfig();
  const { secret, ...rest } = c;
  return { ...rest, source: c.source || 'none', hasSecret: !!secret };
}
function setConfig(input) {
  const cur = loadConfig();
  const allowed = SOURCES.concat('none'); // 'none' = disconnected
  const next = {
    source: allowed.includes(input.source) ? input.source : 'none',
    host: input.host !== undefined ? String(input.host || '').trim().slice(0, 120) : cur.host,
    port: input.port !== undefined ? (input.port ? Number(input.port) : null) : cur.port,
    username: input.username !== undefined ? String(input.username || '').slice(0, 64) : cur.username,
    nas: input.nas !== undefined ? String(input.nas || '').trim().slice(0, 80) : cur.nas,
    secret: input.password ? storage.encrypt(String(input.password)) : cur.secret
  };
  saveConfig(next);
  return getConfig();
}

// ---- Shared helpers ----
function hms(sec) {
  sec = Math.max(0, Math.floor(sec));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return d + 'd ' + h + 'h';
  if (h) return h + 'h ' + m + 'm';
  return m + 'm ' + (sec % 60) + 's';
}

function summarise(subs) {
  const online = subs.filter((s) => s.online);
  return {
    total: subs.length,
    online: online.length,
    offline: subs.length - online.length,
    liveDownBps: online.reduce((a, s) => a + (s.liveDownBps || 0), 0),
    liveUpBps: online.reduce((a, s) => a + (s.liveUpBps || 0), 0),
    bytesDown: subs.reduce((a, s) => a + (s.bytesDown || 0), 0),
    bytesUp: subs.reduce((a, s) => a + (s.bytesUp || 0), 0)
  };
}

// ---- Demo source: deterministic sessions that advance over time so the page looks live. ----
const DEMO_NAMES = [
  'Ahmed Saleh', 'Fatima Noor', 'Omar Haddad', 'Layla Karim', 'Yusuf Aziz', 'Mariam Jalal',
  'Hassan Rifai', 'Noor Abbas', 'Zaid Mansour', 'Huda Nasser', 'Kareem Fadel', 'Sara Qasim',
  'Tariq Amin', 'Dina Farah', 'Samir Odeh', 'Rania Khoury', 'Bilal Hamdan', 'Lina Sabbagh',
  'Firas Daoud', 'Nadia Shadid', 'Mazen Ghanem', 'Rasha Hilal', 'Jamal Barakat', 'Aisha Zahra',
  'Khalil Toma', 'Salma Younan', 'Nabil Aractingi', 'Dalia Srour', 'Wael Kassab', 'Maya Rahhal'
];
const DEMO_PLANS = [
  { plan: 'Home 10M', down: 10, up: 2 },
  { plan: 'Home 20M', down: 20, up: 4 },
  { plan: 'Pro 50M', down: 50, up: 10 },
  { plan: 'Business 100M', down: 100, up: 25 }
];
const DEMO_NAS = ['Sector North', 'Sector West', 'Sector South', 'Fiber OLT'];

function demoSubs(n) {
  n = n || 24;
  const now = Date.now();
  const out = [];
  for (let i = 0; i < n; i++) {
    const name = DEMO_NAMES[i % DEMO_NAMES.length];
    const user = name.toLowerCase().split(' ')[0] + (i + 1) + '@hrins';
    const p = DEMO_PLANS[(i * 7 + 3) % DEMO_PLANS.length];
    // South sector is "down" in the demo, matching the monitoring demo — its clients are offline.
    const nas = DEMO_NAS[i % DEMO_NAS.length];
    const online = nas !== 'Sector South' && (i % 9 !== 4); // ~85% of the two live sectors
    const startedAgo = ((i * 137 + 41) % 1400) * 60 + 90; // seconds, stable per subscriber
    const sessionSeconds = online ? startedAgo + Math.floor((now / 1000) % 600) : 0;
    // Live rate wiggles under the plan ceiling; bytes accumulate with the session length.
    const phase = (now / 1000) / 11 + i;
    const dFrac = online ? 0.08 + 0.5 * (0.5 + 0.5 * Math.sin(phase)) : 0;
    const uFrac = online ? 0.05 + 0.3 * (0.5 + 0.5 * Math.sin(phase + 2)) : 0;
    const liveDownBps = Math.round(p.down * 1e6 * dFrac);
    const liveUpBps = Math.round(p.up * 1e6 * uFrac);
    const bytesDown = Math.round(p.down * 1e6 / 8 * 0.18 * sessionSeconds);
    const bytesUp = Math.round(p.up * 1e6 / 8 * 0.12 * sessionSeconds);
    out.push({
      id: 'sub-' + (i + 1),
      username: user,
      name: name,
      plan: p.plan,
      rateDown: p.down,
      rateUp: p.up,
      online: online,
      framedIp: '10.81.' + (61 + (i % 3)) + '.' + (10 + i),
      mac: 'DC:9F:DB:' + ((i * 11 + 16) % 256).toString(16).padStart(2, '0').toUpperCase() + ':' +
        ((i * 7 + 32) % 256).toString(16).padStart(2, '0').toUpperCase() + ':' +
        ((i * 5 + 1) % 256).toString(16).padStart(2, '0').toUpperCase(),
      nas: nas,
      sessionStart: online ? new Date(now - sessionSeconds * 1000).toISOString() : null,
      sessionSeconds: sessionSeconds,
      sessionText: online ? hms(sessionSeconds) : '—',
      bytesDown: bytesDown,
      bytesUp: bytesUp,
      liveDownBps: liveDownBps,
      liveUpBps: liveUpBps,
      signal: online ? -(52 + ((i * 13) % 24)) : null,
      lastSeen: online ? new Date(now).toISOString() : new Date(now - ((i * 97 + 20) % 2000) * 60000).toISOString()
    });
  }
  return out;
}

// ---- MikroTik source: PPPoE/hotspot active sessions from a router acting as NAS/RADIUS. ----
// Best-effort and fully defensive: any failure returns an empty list with a note, never throws.
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function rateToMbps(rl) {
  // MikroTik rate-limit "rx/tx" like "20M/4M" (as seen from the client: rx=download).
  if (!rl) return { down: null, up: null };
  const parts = String(rl).split('/');
  const toM = (s) => {
    const m = /([\d.]+)\s*([kKmMgG]?)/.exec(s || '');
    if (!m) return null;
    const v = parseFloat(m[1]); const u = m[2].toLowerCase();
    return Math.round((u === 'g' ? v * 1000 : u === 'k' ? v / 1000 : v) * 10) / 10;
  };
  return { down: toM(parts[0]), up: toM(parts[1]) };
}
async function mikrotikSubs(cfg) {
  const mt = require('./transports/mikrotik');
  let session;
  try {
    const password = cfg.secret ? storage.decrypt(cfg.secret) : '';
    session = await mt.Session.open({ host: cfg.host, port: cfg.port || undefined, username: cfg.username || 'admin', password, timeout: 6000 });
    const [active, secrets] = await Promise.all([
      session.run(['/ppp/active/print']),
      session.run(['/ppp/secret/print', '=.proplist=name,profile,rate-limit,comment']).catch(() => [])
    ]);
    const byName = {};
    secrets.forEach((s) => { if (s.name) byName[s.name] = s; });
    const now = Date.now();
    const subs = active.map((a, i) => {
      const sec = byName[a.name] || {};
      const rl = rateToMbps(a['rate-limit'] || sec['rate-limit']);
      const upSec = num(a.uptime && /(\d+)/.test(a.uptime) ? a.uptime : 0) || 0;
      return {
        id: a['.id'] || ('ppp-' + i),
        username: a.name,
        name: sec.comment || a.name,
        plan: sec.profile || a.service || 'PPPoE',
        rateDown: rl.down, rateUp: rl.up,
        online: true,
        framedIp: a.address || null,
        mac: a['caller-id'] || null,
        nas: cfg.nas || a['calling-station-id'] || 'NAS',
        sessionStart: null,
        sessionSeconds: upSec,
        sessionText: a.uptime || '—',
        bytesDown: null, bytesUp: null,
        liveDownBps: null, liveUpBps: null,
        signal: null,
        lastSeen: new Date(now).toISOString()
      };
    });
    return { subscribers: subs, note: null };
  } catch (e) {
    return { subscribers: [], note: 'Could not reach the MikroTik NAS: ' + e.message };
  } finally {
    if (session && session.close) try { session.close(); } catch (e) { /* ignore */ }
  }
}

// ---- SAS Radius 4 source: open sessions from the SAS 4 admin API (read-only). ----
// One login is reused for ~50 minutes (the token lasts about an hour). Live speed is not in the
// API, so it is worked out from how much each session's byte counters grew since the last read.
const sas4State = { session: null, key: '', prev: new Map() };
async function sas4Subs(cfg) {
  const sas4 = require('./transports/sas4');
  const key = [cfg.host, cfg.username, cfg.secret].join('|');
  try {
    let rows;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!sas4State.session || sas4State.key !== key || Date.now() - sas4State.session.openedAt > 50 * 60 * 1000) {
        sas4State.session = await sas4.Sas4Session.login({ host: cfg.host, username: cfg.username, password: cfg.secret ? storage.decrypt(cfg.secret) : '' });
        sas4State.key = key;
      }
      try { rows = await sas4State.session.online(); break; } catch (e) {
        sas4State.session = null;
        if (!e.expired || attempt) throw e; // expired token: log in once more
      }
    }
    const now = Date.now();
    const seen = new Map();
    const subs = rows.map((row) => {
      const m = sas4.mapSession(row);
      const p = sas4State.prev.get(m.id);
      let down = null, up = null;
      if (p && now > p.t && m.bytesDown !== null && m.bytesUp !== null && m.bytesDown >= p.down && m.bytesUp >= p.up) {
        const dt = (now - p.t) / 1000;
        down = Math.round(((m.bytesDown - p.down) * 8) / dt);
        up = Math.round(((m.bytesUp - p.up) * 8) / dt);
      }
      if (m.bytesDown !== null && m.bytesUp !== null) seen.set(m.id, { down: m.bytesDown, up: m.bytesUp, t: now });
      return {
        id: m.id, username: m.username, name: m.name, plan: m.plan, rateDown: null, rateUp: null, online: true,
        framedIp: m.framedIp, mac: m.mac, nas: m.nas || cfg.nas || 'SAS 4',
        sessionStart: m.sessionSeconds ? new Date(now - m.sessionSeconds * 1000).toISOString() : null,
        sessionSeconds: m.sessionSeconds, sessionText: m.sessionSeconds ? hms(m.sessionSeconds) : '—',
        bytesDown: m.bytesDown, bytesUp: m.bytesUp, liveDownBps: down, liveUpBps: up,
        signal: null, lastSeen: new Date(now).toISOString()
      };
    });
    sas4State.prev = seen;
    // The full account list (for offline subscribers, real names and expiry). It can be thousands
    // of rows, so it is re-read every 5 minutes at most; if it cannot be read, the online
    // sessions are still shown.
    let note = null;
    if (!sas4State.users || sas4State.usersKey !== key || now - sas4State.usersAt > 5 * 60 * 1000) {
      try {
        sas4State.users = (await sas4State.session.users()).map(sas4.mapUser);
        sas4State.usersKey = key; sas4State.usersAt = now;
      } catch (e) {
        if (sas4State.usersKey !== key) sas4State.users = null;
        note = 'Showing online sessions only — the full SAS 4 account list could not be read.';
      }
    }
    if (sas4State.users) {
      const byUser = new Map(sas4State.users.map((u) => [u.username, u]));
      const onlineNames = new Set();
      subs.forEach((s) => {
        onlineNames.add(s.username);
        const u = byUser.get(s.username);
        if (!u) return;
        if (u.name && s.name === s.username) s.name = u.name;
        if (s.plan === 'SAS 4') s.plan = u.plan;
        s.expiration = u.expiration; s.phone = u.phone; s.enabled = u.enabled;
      });
      sas4State.users.forEach((u) => {
        if (onlineNames.has(u.username)) return;
        subs.push({
          id: u.id, username: u.username, name: u.name, plan: u.plan, rateDown: null, rateUp: null, online: false,
          framedIp: null, mac: null, nas: cfg.nas || 'SAS 4', sessionStart: null, sessionSeconds: 0, sessionText: '—',
          bytesDown: null, bytesUp: null, liveDownBps: 0, liveUpBps: 0, signal: null,
          lastSeen: u.lastOnline, expiration: u.expiration, phone: u.phone, enabled: u.enabled
        });
      });
    }
    return { subscribers: subs, note };
  } catch (e) {
    return { subscribers: [], note: e.message };
  }
}

// ---- Public: list current subscribers from whichever source is configured. ----
async function list(opts) {
  opts = opts || {};
  if (opts.demo) {
    const subs = demoSubs(24);
    return { source: 'demo', configured: true, server: 'Demo RADIUS', note: null, summary: summarise(subs), subscribers: subs };
  }
  const cfg = loadConfig();
  const source = cfg.source || 'none';
  if (source === 'demo') {
    const subs = demoSubs(24);
    return { source: 'demo', configured: true, server: 'Demo RADIUS', note: null, summary: summarise(subs), subscribers: subs };
  }
  if (source === 'mikrotik') {
    const r = await mikrotikSubs(cfg);
    return { source: 'mikrotik', configured: true, server: cfg.host || 'MikroTik NAS', note: r.note, summary: summarise(r.subscribers), subscribers: r.subscribers };
  }
  if (source === 'sas4') {
    const r = await sas4Subs(cfg);
    return { source: 'sas4', configured: true, server: cfg.host || 'SAS Radius 4', note: r.note, summary: summarise(r.subscribers), subscribers: r.subscribers };
  }
  if (source === 'freeradius') {
    // SQL-backed FreeRADIUS needs a DB driver; not bundled to keep the app offline/portable.
    return { source: 'freeradius', configured: true, server: cfg.host || 'FreeRADIUS', note: 'FreeRADIUS SQL source is not built into this portable build yet.', summary: summarise([]), subscribers: [] };
  }
  return { source: 'none', configured: false, server: null, note: 'No RADIUS/SAS server connected yet.', summary: summarise([]), subscribers: [] };
}

module.exports = { list, getConfig, setConfig, SOURCES, _demoSubs: demoSubs };
