// Applies owner-approved setting changes to a sector radio. This is the only place in TowerDesk
// that changes how a radio transmits, so it is deliberately narrow:
//   - frequency and transmit power only;
//   - the values come from a server-side proposal the owner was shown, never from the browser;
//   - the radio itself is told to put the old values back after REVERT_MIN minutes, so a change
//     that cuts TowerDesk off from the radio, or an owner who does nothing, still ends up safe.
//     "Keep" cancels that; "Undo" restores at once.
// Two kinds of radio:
//   mikrotik - RouterOS API (legacy wireless): a scheduler entry on the router restores the values.
//   airos    - Ubiquiti over SSH: settings are applied unsaved (a reboot restores the old ones)
//              and a countdown job on the radio restores them too; "Keep" saves them to flash.
const devices = require('./devices');
const mikrotik = require('./transports/mikrotik');
const airosSsh = require('./transports/airos-ssh');

const REVERT_MIN = 5;
const SCHED = 'towerdesk-revert';
const pending = new Map(); // deviceId -> { kind, previous, applied, at, revertAt }

function kindOf(device) {
  if (/^mikrotik/.test(String(device.method || ''))) return 'mikrotik';
  if (device.method === 'airos') return 'airos';
  return null;
}

// Which settings can be applied with one click on this device.
function capabilities(device) { return kindOf(device) ? ['frequency', 'txPower'] : []; }
// Ubiquiti apply is new and has not been proven on real radios yet: the screen says so.
function experimental(device) { return kindOf(device) === 'airos'; }

function whyNot(device) {
  if (kindOf(device)) return null;
  return 'One-click apply works on MikroTik sectors connected with the MikroTik API and on Ubiquiti airOS radios. On this radio, set the values on its own page.';
}

// ---------- MikroTik ----------
async function openMikrotik(device) {
  const o = devices.connectionOptions(devices.get(device.id) || device);
  return mikrotik.Session.open({ host: o.host, port: o.port || undefined, username: o.username, password: o.password, secure: device.method === 'mikrotik-ssl' });
}

async function removeSchedule(session) {
  const rows = await session.run(['/system/scheduler/print', '?name=' + SCHED, '=.proplist=.id']);
  for (const r of rows) if (r['.id']) await session.run(['/system/scheduler/remove', '=.id=' + r['.id']]);
}

// RouterOS script that restores the previous values and then removes its own scheduler entry.
function revertScript(w) {
  const parts = ['frequency=' + w.frequencyRaw, 'tx-power-mode=' + w.txPowerMode];
  if (w.txPowerMode !== 'default' && w.txPower !== null) parts.push('tx-power=' + w.txPower);
  return '/interface wireless set [find name="' + w.name + '"] ' + parts.join(' ') + '; /system scheduler remove [find name="' + SCHED + '"]';
}

function setWords(w, changes) {
  const words = ['/interface/wireless/set', '=.id=' + w.id];
  changes.forEach((c) => {
    if (c.setting === 'frequency') words.push('=frequency=' + c.to);
    if (c.setting === 'txPower') { words.push('=tx-power-mode=all-rates-fixed'); words.push('=tx-power=' + c.to); }
  });
  return words;
}

async function applyMikrotik(device, list) {
  const session = await openMikrotik(device);
  try {
    const w = await mikrotik.readWireless(session);
    if (!w) throw new Error('No access-point radio found on this router.');
    if (!/^[\w.-]+$/.test(w.name) || !/^[\w.-]+$/.test(String(w.frequencyRaw)) || !/^[\w-]+$/.test(String(w.txPowerMode))) throw new Error('This radio reports settings TowerDesk does not recognise, so it was left alone.');
    // Safety net first: if the next command cuts us off, the router still undoes it by itself.
    await removeSchedule(session);
    await session.run(['/system/scheduler/add', '=name=' + SCHED, '=interval=' + REVERT_MIN + 'm', '=on-event=' + revertScript(w), '=comment=TowerDesk: undo the last sector change unless it is kept']);
    try {
      await session.run(setWords(w, list));
    } catch (e) {
      await removeSchedule(session).catch(() => {});
      throw new Error('The router refused the change: ' + String(e.message || 'error').slice(0, 120));
    }
    const now = Date.now();
    return {
      kind: 'mikrotik',
      previous: { frequency: w.frequency, txPower: w.txPower, txPowerMode: w.txPowerMode, frequencyRaw: w.frequencyRaw },
      applied: list.map((c) => ({ setting: c.setting, label: c.label, unit: c.unit, from: c.setting === 'frequency' ? w.frequency : w.txPower, to: c.to })),
      at: now, revertAt: now + REVERT_MIN * 60 * 1000
    };
  } finally {
    session.close();
  }
}

async function keepMikrotik(device) {
  const session = await openMikrotik(device);
  try { await removeSchedule(session); } finally { session.close(); }
}

async function undoMikrotik(device, rec) {
  const session = await openMikrotik(device);
  try {
    const w = await mikrotik.readWireless(session);
    if (w) {
      const words = ['/interface/wireless/set', '=.id=' + w.id, '=frequency=' + rec.previous.frequencyRaw, '=tx-power-mode=' + rec.previous.txPowerMode];
      if (rec.previous.txPowerMode !== 'default' && rec.previous.txPower !== null) words.push('=tx-power=' + rec.previous.txPower);
      await session.run(words);
    }
    await removeSchedule(session);
  } finally { session.close(); }
}

// ---------- Ubiquiti airOS (SSH) ----------
async function openAiros(device) {
  const raw = devices.get(device.id) || device;
  const o = devices.connectionOptions(raw);
  try {
    return await airosSsh.open({ host: o.host, port: Number(raw.sshPort) || 22, username: o.username || 'ubnt', password: o.password });
  } catch (e) {
    if (e.kind === 'auth') throw new Error('The radio refused the SSH login. Turn SSH on in the radio\'s Services page and use the same login as its web page.');
    throw new Error('Could not open SSH on this radio (' + String(e.message || 'error').slice(0, 100) + '). Turn SSH on in its Services page.');
  }
}

async function applyAiros(device, list) {
  const shell = await openAiros(device);
  try {
    const pf = await airosSsh.preflight(shell);
    if (!pf.ok) throw new Error(pf.problems[0]);
    // Each change must start from the value the owner was shown; if the radio moved on since,
    // or counts power differently from what TowerDesk displays, leave it alone.
    const values = {};
    const used = [];
    for (const c of list) {
      if (c.setting === 'frequency') {
        if (!pf.canFrequency) throw new Error('This radio does not show a frequency TowerDesk can change.');
        if (c.from !== null && c.from !== undefined && pf.frequency !== c.from) throw new Error('The radio\'s frequency is ' + pf.frequency + ' MHz now, not ' + c.from + ' MHz as shown. Check the sector again.');
        values.frequency = c.to; used.push({ setting: 'frequency', label: c.label, unit: c.unit, from: pf.frequency, to: c.to });
      } else if (c.setting === 'txPower') {
        if (!pf.canTxPower) throw new Error('This radio does not show a transmit power TowerDesk can change.');
        if (c.from === null || c.from === undefined || pf.txPower !== c.from) throw new Error('The radio counts transmit power differently (' + pf.txPower + ' saved, ' + (c.from === null || c.from === undefined ? 'unknown' : c.from) + ' shown), so it was left alone.');
        values.txPower = c.to; used.push({ setting: 'txPower', label: c.label, unit: c.unit, from: pf.txPower, to: c.to });
      }
    }
    if (!used.length) throw new Error('Nothing to apply.');
    // Safety net first: copy of the running settings + the countdown job on the radio.
    await airosSsh.schedule(shell, REVERT_MIN * 60);
    let got;
    try {
      got = await airosSsh.change(shell, values);
      if ((values.frequency !== undefined && got.frequency !== values.frequency) || (values.txPower !== undefined && got.txPower !== values.txPower)) throw new Error('The radio did not take the new values.');
    } catch (e) {
      await airosSsh.undo(shell).catch(() => {}); // the countdown job is the backup if even this fails
      throw new Error('The change was rolled back: ' + String(e.message || 'error').slice(0, 120));
    }
    const now = Date.now();
    return { kind: 'airos', previous: { frequency: pf.frequency, txPower: pf.txPower }, applied: used, at: now, revertAt: now + REVERT_MIN * 60 * 1000 };
  } finally {
    shell.close();
  }
}

async function keepAiros(device) {
  const shell = await openAiros(device);
  try { await airosSsh.keep(shell); } catch (e) { if (e.kind === 'gone') pending.delete(device.id); throw new Error(e.message); } finally { shell.close(); }
}

async function undoAiros(device) {
  const shell = await openAiros(device);
  try { await airosSsh.undo(shell); } finally { shell.close(); }
}

// ---------- shared ----------
// Read-only: can this radio be changed? Used by the "Test this radio" button. Changes nothing.
async function preflight(device) {
  const kind = kindOf(device);
  if (!kind) return { ok: false, problems: [whyNot(device)] };
  if (kind === 'mikrotik') {
    let session;
    try { session = await openMikrotik(device); } catch (e) { return { ok: false, problems: ['Could not log in to the router with the MikroTik API.'] }; }
    try {
      const w = await mikrotik.readWireless(session);
      if (!w) return { ok: false, problems: ['No access-point radio was found on this router.'] };
      return { ok: true, problems: [], frequency: w.frequency, txPower: w.txPower, channelWidth: w.channelWidth };
    } finally { session.close(); }
  }
  let shell;
  try { shell = await openAiros(device); } catch (e) { return { ok: false, problems: [e.message] }; }
  try {
    const pf = await airosSsh.preflight(shell);
    return { ok: pf.ok, problems: pf.problems, frequency: pf.frequency, txPower: pf.txPower, channelWidth: pf.channelWidth };
  } catch (e) {
    return { ok: false, problems: ['The radio did not answer the check (' + String(e.message || 'error').slice(0, 100) + ').'] };
  } finally { shell.close(); }
}

// Applies the given (already validated) changes. Returns what was set and when it reverts.
async function apply(device, changes) {
  const kind = kindOf(device);
  if (!kind) throw new Error(whyNot(device));
  const list = (changes || []).filter((c) => c && c.applicable && ['frequency', 'txPower'].includes(c.setting) && Number.isInteger(c.to));
  if (!list.length) throw new Error('Nothing to apply.');
  if (pending.has(device.id)) throw new Error('An earlier change on this sector is still waiting for Keep or Undo.');
  const rec = kind === 'mikrotik' ? await applyMikrotik(device, list) : await applyAiros(device, list);
  pending.set(device.id, rec);
  return status(device.id);
}

// Keep the change: cancel the radio's undo (airOS: save to flash first).
async function keep(device) {
  const rec = pending.get(device.id);
  if (!rec) throw new Error('Nothing is waiting on this sector.');
  if (Date.now() >= rec.revertAt) { pending.delete(device.id); throw new Error('Too late: the radio has already put the old values back.'); }
  if (rec.kind === 'airos') await keepAiros(device); else await keepMikrotik(device);
  pending.delete(device.id);
  return { kept: true };
}

// Undo now: put the old values back and cancel the radio's undo.
async function undo(device) {
  const rec = pending.get(device.id);
  if (!rec) throw new Error('Nothing is waiting on this sector.');
  if (rec.kind === 'airos') await undoAiros(device); else await undoMikrotik(device, rec);
  pending.delete(device.id);
  return { undone: true };
}

function status(deviceId) {
  const rec = pending.get(deviceId);
  if (!rec) return null;
  if (Date.now() >= rec.revertAt) { pending.delete(deviceId); return { expired: true, applied: rec.applied }; }
  return { applied: rec.applied, revertAt: rec.revertAt, secondsLeft: Math.max(0, Math.round((rec.revertAt - Date.now()) / 1000)), revertMinutes: REVERT_MIN };
}

module.exports = { capabilities, experimental, whyNot, preflight, apply, keep, undo, status, REVERT_MIN, SCHED, _pending: pending };
