// Self-updater for the portable build. The operator points TowerDesk at a GitHub repo (or any
// release manifest URL); "Check for updates" compares the published version to this one, and
// "Download & install" stages the new files. Because a running server can't overwrite its own
// locked files on Windows, the update is STAGED here and applied by the launcher on the next
// start (apply-update.cmd), which copies the staged files over the app while leaving data/ alone.
//
// Offline by default: nothing is fetched unless the operator clicks. No personal data is sent —
// only a generic User-Agent, as GitHub's API requires one.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { dataDir } = require('./paths');

const APP_DIR = path.join(__dirname, '..');
const CFG = path.join(dataDir(), 'update.json');
const UPDATES_DIR = path.join(dataDir(), 'updates');
const STAGED_DIR = path.join(UPDATES_DIR, 'staged');
const PENDING = path.join(UPDATES_DIR, 'pending.json');
const UA = 'TowerDesk-Updater';

function currentVersion() {
  try { return require(path.join(APP_DIR, 'package.json')).version || '0.0.0'; } catch (e) { return '0.0.0'; }
}

// ---- Semver-ish compare (numeric major.minor.patch; ignores any pre-release suffix). ----
function parseVer(v) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}
function isNewer(candidate, base) {
  const a = parseVer(candidate), b = parseVer(base);
  for (let i = 0; i < 3; i++) { if (a[i] > b[i]) return true; if (a[i] < b[i]) return false; }
  return false;
}

// ---- Config (data/update.json): where to look for updates. ----
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch (e) { return {}; }
}
function getConfig() {
  const c = loadConfig();
  return { repo: c.repo || '', manifestUrl: c.manifestUrl || '', channel: c.channel || 'release' };
}
function setConfig(input) {
  const next = {
    repo: String((input && input.repo) || '').trim().slice(0, 140),
    manifestUrl: String((input && input.manifestUrl) || '').trim().slice(0, 400),
    channel: input && input.channel === 'prerelease' ? 'prerelease' : 'release'
  };
  fs.mkdirSync(path.dirname(CFG), { recursive: true });
  const tmp = CFG + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, CFG);
  return getConfig();
}

// ---- Pure: turn a GitHub release (or a plain manifest) into our update descriptor. ----
// Exposed for tests so the parsing is verified without any network.
function describeRelease(rel) {
  if (!rel || typeof rel !== 'object') return null;
  const tag = rel.tag_name || rel.version || rel.name || '';
  const version = parseVer(tag).join('.');
  // Prefer a .zip release asset; fall back to the source zipball.
  let downloadUrl = rel.downloadUrl || rel.zipUrl || '';
  if (!downloadUrl && Array.isArray(rel.assets)) {
    const zip = rel.assets.find((a) => a && /\.zip$/i.test(a.name || '') && a.browser_download_url);
    if (zip) downloadUrl = zip.browser_download_url;
  }
  if (!downloadUrl) downloadUrl = rel.zipball_url || '';
  return {
    version: version,
    tag: tag,
    notes: String(rel.body || rel.notes || '').slice(0, 4000),
    htmlUrl: rel.html_url || rel.url || '',
    downloadUrl: downloadUrl,
    prerelease: !!rel.prerelease
  };
}

function httpJson(url) {
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github+json' } })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}

// ---- Check the configured source for a newer version. Throws on network/config problems. ----
async function check() {
  const cfg = getConfig();
  const current = currentVersion();
  let rel;
  if (cfg.manifestUrl) {
    rel = await httpJson(cfg.manifestUrl);
  } else if (cfg.repo) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) throw new Error('Repo must look like "owner/name".');
    if (cfg.channel === 'prerelease') {
      const list = await httpJson('https://api.github.com/repos/' + cfg.repo + '/releases');
      rel = Array.isArray(list) ? list[0] : null;
    } else {
      rel = await httpJson('https://api.github.com/repos/' + cfg.repo + '/releases/latest');
    }
  } else {
    throw new Error('No update source set. Add your GitHub repo (owner/name) first.');
  }
  const d = describeRelease(rel);
  if (!d || !d.version) throw new Error('No published release found.');
  return {
    current: current,
    latest: d.version,
    tag: d.tag,
    available: isNewer(d.version, current),
    notes: d.notes,
    htmlUrl: d.htmlUrl,
    downloadUrl: d.downloadUrl
  };
}

// ---- Staging ----
function pending() {
  try { return JSON.parse(fs.readFileSync(PENDING, 'utf8')); } catch (e) { return null; }
}

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

// Validate an already-extracted update folder and stage it. `srcDir` must contain the new app
// (a package.json at its root, or in a single nested folder like GitHub's zipball). Returns the
// staged descriptor. No network — used directly by tests and by stage() after download/extract.
function stageFromDir(srcDir) {
  let root = srcDir;
  if (!fs.existsSync(path.join(root, 'package.json'))) {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    const nested = entries.find((e) => fs.existsSync(path.join(srcDir, e.name, 'package.json')));
    if (!nested) throw new Error('Update bundle has no package.json.');
    root = path.join(srcDir, nested.name);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'towerdesk') throw new Error('Update bundle is not TowerDesk (' + pkg.name + ').');

  rmrf(STAGED_DIR);
  fs.mkdirSync(STAGED_DIR, { recursive: true });
  fs.cpSync(root, STAGED_DIR, { recursive: true });
  // Never let a bundle smuggle in its own data/ over the operator's.
  rmrf(path.join(STAGED_DIR, 'data'));

  const marker = { version: pkg.version || '0.0.0', stagedAt: new Date().toISOString(), applied: false };
  fs.writeFileSync(PENDING, JSON.stringify(marker, null, 2));
  return marker;
}

function extract(zipPath, destDir) {
  // Windows 10+ ships bsdtar as tar.exe, which extracts .zip and .tar.gz with no npm dependency.
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    execFile('tar', ['-xf', zipPath, '-C', destDir], (err) => (err ? reject(new Error('Could not unpack the update (' + err.message + ').')) : resolve()));
  });
}

// Download a bundle and stage it. Throws on any failure; leaves no half-written pending marker.
async function stage(downloadUrl) {
  if (!downloadUrl) throw new Error('No download URL for this update.');
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
  const zipPath = path.join(UPDATES_DIR, 'download.zip');
  const extractDir = path.join(UPDATES_DIR, 'extract');
  rmrf(extractDir);
  const res = await fetch(downloadUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Download failed (HTTP ' + res.status + ').');
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(zipPath, buf);
  await extract(zipPath, extractDir);
  const marker = stageFromDir(extractDir);
  rmrf(extractDir); rmrf(zipPath);
  return marker;
}

function clearStaged() { rmrf(STAGED_DIR); rmrf(PENDING); }

function status() {
  const p = pending();
  return {
    current: currentVersion(),
    config: getConfig(),
    staged: p ? { version: p.version, stagedAt: p.stagedAt } : null,
    canSelfUpdate: process.platform === 'win32'
  };
}

module.exports = {
  currentVersion, isNewer, parseVer, describeRelease,
  getConfig, setConfig, check, stage, stageFromDir, pending, clearStaged, status,
  APP_DIR, STAGED_DIR, UPDATES_DIR
};
