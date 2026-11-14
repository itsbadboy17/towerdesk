// "Lab data": a second TowerDesk with its own data folder, started on request, for testing against a lab network
// (for example a GNS3 lab) without any chance of touching real devices. It is a separate process on a separate port,
// reachable from this computer only, and it announces itself (TOWERDESK_LAB=1) so every page can say so.
// The lab's data folder can never be the real data folder. Passwords the lab holds are the lab's own.
const fs = require('fs');
const path = require('path');
const http = require('http');
const cp = require('child_process');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'lab.json');
const ROOT = path.join(__dirname, '..');
const mainPort = () => Number(process.env.PORT) || 3000;

function load() { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function config() {
  const v = load();
  return { dataDir: v.dataDir ? String(v.dataDir) : dataDir() + '-lab', port: Number(v.port) || 3001, mockSas: v.mockSas !== false, mockSasPort: Number(v.mockSasPort) || 8085 };
}
function same(a, b) { return path.resolve(String(a)).toLowerCase() === path.resolve(String(b)).toLowerCase(); }

function setConfig(patch) {
  patch = patch || {};
  const cur = config(), next = Object.assign({}, cur);
  if (patch.dataDir !== undefined) {
    const d = String(patch.dataDir || '').trim();
    if (!d || d.length > 260) return { error: 'Give the lab a data folder of its own.' };
    if (same(d, dataDir())) return { error: 'The lab must not use your real data folder.' };
    next.dataDir = d;
  }
  if (patch.port !== undefined) {
    const p = Number(patch.port);
    if (!(Number.isInteger(p) && p >= 1024 && p <= 65535)) return { error: 'The port is a number from 1024 to 65535.' };
    if (p === mainPort() || p === cur.mockSasPort) return { error: 'That port is already used by TowerDesk itself.' };
    next.port = p;
  }
  if (patch.mockSas !== undefined) next.mockSas = !!patch.mockSas;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ dataDir: next.dataDir, port: next.port, mockSas: next.mockSas, mockSasPort: next.mockSasPort }, null, 2));
  return { ok: true, config: config() };
}

// Does something answer on this port, and does it say it is a lab? (never trust a bare answer: port 3001 could be anything)
function probe(port, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/session', timeout: timeoutMs || 1500 }, (res) => {
      let b = ''; res.on('data', (d) => { if (b.length < 2000) b += d; });
      res.on('end', () => { try { const j = JSON.parse(b); resolve({ answers: true, lab: j.lab === true }); } catch (e) { resolve({ answers: true, lab: false }); } });
    });
    req.on('timeout', () => { req.destroy(); resolve({ answers: false, lab: false }); });
    req.on('error', () => resolve({ answers: false, lab: false }));
  });
}
function listening(port) {
  return new Promise((resolve) => { const s = require('net').connect(port, '127.0.0.1'); s.setTimeout(800); s.on('connect', () => { s.destroy(); resolve(true); }); s.on('error', () => resolve(false)); s.on('timeout', () => { s.destroy(); resolve(false); }); });
}

let kids = { lab: null, sas: null };
let deps = { spawn: (...a) => cp.spawn(...a), probe, listening };

async function status() {
  const c = config();
  const p = await deps.probe(c.port);
  const sas = c.mockSas ? await deps.listening(c.mockSasPort) : false;
  return {
    config: c, url: 'http://localhost:' + c.port,
    running: p.lab, ready: p.lab,
    blocked: p.answers && !p.lab ? 'Something else is using port ' + c.port + ' and it is not marked as the lab, so TowerDesk will not open it as lab data. Choose another port in Settings.' : null,
    startedHere: !!kids.lab, mockSasRunning: sas
  };
}

async function start() {
  if (process.env.TOWERDESK_LAB === '1') return { error: 'You are already in the lab.' };
  const c = config();
  if (same(c.dataDir, dataDir())) return { error: 'The lab must not use your real data folder.' };
  const cur = await status();
  if (cur.blocked) return { error: cur.blocked };
  fs.mkdirSync(c.dataDir, { recursive: true });
  if (!cur.running) {
    const env = Object.assign({}, process.env, { TOWERDESK_DATA_DIR: c.dataDir, PORT: String(c.port), TOWERDESK_HOST: '127.0.0.1', TOWERDESK_LAB: '1', TOWERDESK_MAIN_URL: 'http://localhost:' + mainPort() });
    delete env.TOWERDESK_DEMO; delete env.TOWERDESK_AUTH;
    kids.lab = deps.spawn(process.execPath, [path.join(ROOT, 'server.js')], { env, cwd: ROOT, stdio: 'ignore', windowsHide: true });
    const me = kids.lab;
    me.on('exit', () => { if (kids.lab === me) kids.lab = null; });
    me.on('error', () => { if (kids.lab === me) kids.lab = null; });
  }
  if (c.mockSas && !(await deps.listening(c.mockSasPort))) {
    kids.sas = deps.spawn(process.execPath, [path.join(ROOT, 'scripts', 'mock-sas4.js'), '--port', String(c.mockSasPort)], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
    const me = kids.sas;
    me.on('exit', () => { if (kids.sas === me) kids.sas = null; });
    me.on('error', () => { if (kids.sas === me) kids.sas = null; });
  }
  return { ok: true };
}

// Stops what this TowerDesk started. A lab someone else started (from a terminal) is left running.
async function stop() {
  const had = !!(kids.lab || kids.sas);
  [kids.lab, kids.sas].forEach((k) => { try { if (k) k.kill(); } catch (e) { /* already gone */ } });
  kids = { lab: null, sas: null };
  return { ok: true, stopped: had };
}
function stopSync() { [kids.lab, kids.sas].forEach((k) => { try { if (k) k.kill(); } catch (e) { /* gone */ } }); kids = { lab: null, sas: null }; }

module.exports = { config, setConfig, status, start, stop, stopSync, probe, _use: (d) => { deps = Object.assign({}, deps, d); }, _kids: () => kids };
