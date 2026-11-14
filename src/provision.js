// Setting up a radio from a template (name, Wi-Fi name and password, role, channel). Two stages:
//   plan  - READ-ONLY. Logs in, reads the radio's current settings and says exactly what would change.
//   apply - writes, and only when the owner has switched writing on in Settings. It uses the same safety net as the
//           sector advisor: a copy of the settings, an undo timer running ON the radio, and "Keep" to make it permanent.
// Writing is OFF by default. Passwords typed for a radio are used for that one request (and held in memory for the
// few minutes the undo timer runs, so Keep/Undo can log in again); they are never written to disk or to a log.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');
const model = require('../public/provision-model.js');
let ssh = require('./transports/airos-ssh');

const FILE = path.join(dataDir(), 'provision.json');
const REVERT_MIN = 5;
const pending = new Map(); // host -> { username, password, revertAt, changes }

function load() { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function settings() { return { allowWrite: load().allowWrite === true }; }
function setAllowWrite(on) {
  const v = load(); v.allowWrite = !!on;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(v, null, 2));
  return settings();
}

function validHost(h) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(String(h || '')) && String(h).split('.').every((n) => Number(n) <= 255); }
function say(e, fallback) {
  // The SSH layer's messages are written for the owner and contain no secrets; anything else gets a plain line.
  return e && e.name === 'SshError' ? e.message : (e && e.message && /^[\w .,'’:()-]{1,160}$/.test(e.message) ? e.message : fallback);
}

async function openRadio(host, username, password) {
  try { return await ssh.open({ host, username: username || 'ubnt', password }); }
  catch (e) {
    if (e && e.kind === 'auth') throw new Error('The radio refused that username and password over SSH. Check the login, and that SSH is switched on in the radio\'s Services page.');
    throw new Error('Could not open SSH on the radio (' + String((e && e.message) || 'error').slice(0, 100) + '). Turn SSH on in its Services page.');
  }
}

// body: { host, username, password, template, values, brand }
async function plan(body) {
  body = body || {};
  if (!validHost(body.host)) return { ok: false, error: 'Type the radio\'s IP address, for example 192.168.1.20.' };
  const v = model.validate(body.template, body.values);
  if (!v.ok) return { ok: false, errors: v.errors };
  const writeOn = settings().allowWrite;
  if (body.brand === 'mikrotik') {
    return { ok: true, brand: 'mikrotik', commands: model.mikrotikPreview(body.template, v.clean), canApply: false, writeOn, note: 'This is the preview of the commands. Applying them to a MikroTik comes after the Ubiquiti setup has been proven on a real radio.' };
  }
  const shell = await openRadio(body.host, body.username, body.password);
  try {
    const cfg = await ssh.readCfg(shell);
    const pf = await ssh.preflight(shell);
    const p = model.airosPlan(body.template, v.clean, cfg);
    const fatal = pf.problems.filter((x) => !/frequency and power/.test(x));
    return { ok: true, brand: 'airos', rows: p.rows, changes: p.changes.length, problems: p.problems.concat(fatal), writeOn, canApply: writeOn && p.changes.length > 0 && fatal.length === 0, revertMin: REVERT_MIN };
  } finally { shell.close(); }
}

async function apply(body) {
  if (!settings().allowWrite) throw new Error('Writing to radios is switched off. An admin can switch it on in Settings once you are ready to test on a spare radio.');
  body = body || {};
  if (body.brand === 'mikrotik') throw new Error('Applying to a MikroTik is not available yet.');
  if (!validHost(body.host)) throw new Error('Type the radio\'s IP address.');
  const v = model.validate(body.template, body.values);
  if (!v.ok) throw new Error('Some of the values are not valid. Run the preview again.');
  const shell = await openRadio(body.host, body.username, body.password);
  try {
    const pf = await ssh.preflight(shell);
    const fatal = pf.problems.filter((x) => !/frequency and power/.test(x));
    if (fatal.length) throw new Error(fatal[0]);
    // Plan again from the radio as it is NOW, so nothing is applied on a stale preview.
    const cfg = await ssh.readCfg(shell);
    const p = model.airosPlan(body.template, v.clean, cfg);
    if (!p.changes.length) throw new Error('Nothing to change: the radio already has these settings.');
    const changes = {};
    p.changes.forEach((r) => { changes[r.key] = r.value; });
    await ssh.schedule(shell, REVERT_MIN * 60); // copy + undo timer on the radio, before anything is changed
    let after;
    try {
      after = await ssh.changeKeys(shell, changes);
      const wrong = Object.keys(changes).filter((k) => String(after[k]) !== String(changes[k]));
      if (wrong.length) throw new Error('The radio did not take: ' + wrong.join(', '));
    } catch (e) {
      await ssh.undo(shell).catch(() => {}); // the timer on the radio is the backup if even this fails
      throw new Error('The change was rolled back: ' + say(e, 'the radio did not accept it').slice(0, 140));
    }
    const revertAt = Date.now() + REVERT_MIN * 60 * 1000;
    pending.set(body.host, { username: body.username, password: body.password, revertAt, changes: p.changes.map((r) => ({ label: r.label, from: r.from, to: r.to })) });
    setTimeout(() => { const cur = pending.get(body.host); if (cur && cur.revertAt === revertAt) pending.delete(body.host); }, REVERT_MIN * 60 * 1000 + 60000).unref();
    return { ok: true, revertAt, revertMin: REVERT_MIN, applied: p.changes.map((r) => ({ label: r.label, from: r.from, to: r.to })) };
  } finally { shell.close(); }
}

async function finish(host, how) {
  const cur = pending.get(host);
  if (!cur) throw new Error('There is nothing waiting on that radio. It may already have put its old settings back.');
  const shell = await openRadio(host, cur.username, cur.password);
  try {
    if (how === 'keep') { try { await ssh.keep(shell); } catch (e) { if (e && e.kind === 'gone') pending.delete(host); throw new Error(say(e, 'The radio did not confirm.')); } }
    else await ssh.undo(shell);
    pending.delete(host);
    return { ok: true };
  } finally { shell.close(); }
}
const keep = (host) => finish(host, 'keep');
const undo = (host) => finish(host, 'undo');
function status(host) { const c = pending.get(host); return c ? { waiting: true, revertAt: c.revertAt, applied: c.changes } : { waiting: false }; }

module.exports = { settings, setAllowWrite, plan, apply, keep, undo, status, validHost, REVERT_MIN, _useSsh: (x) => { ssh = x; }, _pending: pending };
