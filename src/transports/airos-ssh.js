// Ubiquiti airOS over SSH: the commands behind "apply a sector change" (see radio.js).
//
// How the safety net works. airOS keeps two copies of its settings: the running copy in
// /tmp/system.cfg and the saved copy in flash. A change is applied to the running copy only,
// so a reboot at any moment brings the old settings back by itself. On top of that a countdown
// job started ON THE RADIO puts the old running copy back after a few minutes. Only "Keep"
// writes the new settings to flash. Nothing depends on TowerDesk staying open or connected.
//
// All commands below are fixed text; the only values placed in them are whole numbers that are
// checked first. Nothing here is run except from radio.js after the owner accepted a change.
const { Client } = require('ssh2');
const { friendlyError } = require('./common');

const CFG = '/tmp/system.cfg';
const NEWCFG = '/tmp/towerdesk-new.cfg';
const PREV = '/tmp/towerdesk-prev.cfg';
const PIDF = '/tmp/towerdesk-revert.pid';
const APPLY = '/usr/etc/rc.d/rc.softrestart'; // re-applies the running settings
const SAVE = 'cfgmtd -w -p /etc/';             // writes the running settings to flash

class SshError extends Error {
  constructor(kind, message) { super(message); this.name = 'SshError'; this.kind = kind; }
}

// A logged-in SSH connection that can run one command at a time.
class Shell {
  constructor(conn) { this.conn = conn; this.closed = false; conn.on('close', () => { this.closed = true; }); conn.on('error', () => { this.closed = true; }); }
  run(cmd, timeout = 20000) {
    if (this.closed) return Promise.reject(new SshError('network', 'The SSH connection closed.'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.close(); reject(new SshError('network', 'The radio did not answer in time.')); }, timeout);
      this.conn.exec(cmd, (err, stream) => {
        if (err) { clearTimeout(timer); return reject(new SshError('network', friendlyError(err))); }
        let out = '';
        stream.on('data', (d) => { if (out.length < 200000) out += d.toString('utf8'); });
        stream.stderr.on('data', (d) => { if (out.length < 200000) out += d.toString('utf8'); });
        stream.on('close', (code) => { clearTimeout(timer); resolve({ code: code === undefined || code === null ? 0 : code, out }); });
      });
    });
  }
  close() { this.closed = true; try { this.conn.end(); } catch (e) { /* already closed */ } }
}

function open({ host, port = 22, username, password, timeout = 8000 }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let done = false;
    const fail = (kind, err) => { if (done) return; done = true; try { conn.end(); } catch (e) { /* ignore */ } reject(new SshError(kind, typeof err === 'string' ? err : friendlyError(err))); };
    conn.on('ready', () => { if (done) return; done = true; resolve(new Shell(conn)); });
    conn.on('keyboard-interactive', (name, instr, lang, prompts, reply) => reply(prompts.map(() => password || '')));
    conn.on('error', (err) => fail(err && (err.level === 'client-authentication') ? 'auth' : 'network', err && err.level === 'client-authentication' ? 'Wrong username or password for SSH' : err));
    try {
      conn.connect({
        host, port, username: username || 'ubnt', password: password || '', tryKeyboard: true, readyTimeout: timeout,
        algorithms: {
          kex: { append: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'] },
          serverHostKey: { append: ['ssh-rsa', 'ssh-dss'] },
          cipher: { append: ['aes128-cbc', 'aes256-cbc', '3des-cbc'] }
        }
      });
    } catch (err) { fail('network', err); }
  });
}

// "key=value" lines of system.cfg.
function parseCfg(text) {
  const out = {};
  String(text || '').split(/\r?\n/).forEach((line) => {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return out;
}
function whole(v) { return /^-?\d{1,5}$/.test(String(v)) ? Number(v) : null; }

// Read-only check that this radio can be changed the way radio.js does it. Changes nothing.
async function preflight(shell) {
  const problems = [];
  const cat = await shell.run('cat ' + CFG);
  const cfg = parseCfg(cat.out);
  const freq = whole(cfg['radio.1.freq']);
  const txPower = whole(cfg['radio.1.txpower']);
  if (cat.code !== 0 || !Object.keys(cfg).length) problems.push('The radio\'s settings file could not be read, so this is not a firmware TowerDesk knows.');
  else if (freq === null && txPower === null) problems.push('The radio keeps its frequency and power somewhere TowerDesk does not recognise (it may be in automatic mode).');
  const tools = await shell.run('test -x "$(command -v cfgmtd)" && test -x ' + APPLY + ' && echo TD_TOOLS_OK');
  if (!/TD_TOOLS_OK/.test(tools.out)) problems.push('The radio is missing the tools needed to apply and save settings safely.');
  const clean = await shell.run('test ! -e ' + PREV + ' && echo TD_CLEAN');
  if (!/TD_CLEAN/.test(clean.out)) problems.push('An earlier TowerDesk change on this radio is still waiting. It puts itself right in a few minutes; try again after that.');
  return {
    ok: problems.length === 0, problems,
    frequency: freq, txPower, channelWidth: whole(cfg['radio.1.chanbw']),
    canFrequency: freq !== null, canTxPower: txPower !== null
  };
}

// Step 1: keep a copy of the running settings and start the countdown job on the radio.
async function schedule(shell, seconds) {
  const secs = Math.max(60, Math.min(1800, Math.round(Number(seconds))));
  const b = await shell.run('cp ' + CFG + ' ' + PREV + ' && echo TD_BACKUP_OK');
  if (!/TD_BACKUP_OK/.test(b.out)) throw new SshError('protocol', 'Could not keep a copy of the radio\'s settings, so nothing was changed.');
  // The job restores the running copy only; it never writes to flash.
  const job = 'sleep ' + secs + '; cp ' + PREV + ' ' + CFG + ' && ' + APPLY + '; rm -f ' + PREV + ' ' + PIDF;
  const s = await shell.run('nohup sh -c \'' + job + '\' >/dev/null 2>&1 & echo $! > ' + PIDF + '; echo TD_SCHEDULED');
  if (!/TD_SCHEDULED/.test(s.out)) {
    await shell.run('rm -f ' + PREV).catch(() => {});
    throw new SshError('protocol', 'Could not start the undo timer on the radio, so nothing was changed.');
  }
}

// Step 2: put the new numbers in the running settings and apply them (not saved to flash).
async function change(shell, values) {
  const exprs = [];
  if (values.frequency !== undefined) {
    if (!/^\d{4,5}$/.test(String(values.frequency))) throw new SshError('protocol', 'Bad frequency.');
    exprs.push('-e \'s/^radio\\.1\\.freq=.*/radio.1.freq=' + values.frequency + '/\'');
  }
  if (values.txPower !== undefined) {
    if (!/^\d{1,2}$/.test(String(values.txPower))) throw new SshError('protocol', 'Bad power.');
    exprs.push('-e \'s/^radio\\.1\\.txpower=.*/radio.1.txpower=' + values.txPower + '/\'');
  }
  if (!exprs.length) throw new SshError('protocol', 'Nothing to change.');
  const r = await shell.run('sed ' + exprs.join(' ') + ' ' + CFG + ' > ' + NEWCFG + ' && cp ' + NEWCFG + ' ' + CFG + ' && rm -f ' + NEWCFG + ' && ' + APPLY + '; echo TD_APPLIED');
  if (!/TD_APPLIED/.test(r.out)) throw new SshError('protocol', 'The radio did not confirm the change.');
  const check = parseCfg((await shell.run('cat ' + CFG)).out);
  return { frequency: whole(check['radio.1.freq']), txPower: whole(check['radio.1.txpower']) };
}

// Setting up a radio: write several settings of the running copy at once. Only keys on this list can be written,
// only when the radio ALREADY has the key (a missing key is never added), and values are limited to a narrow
// character set, so nothing typed can break out of the command. Not saved to flash: "Keep" does that.
const SETUP_KEYS = new Set(['radio.1.mode', 'radio.1.freq', 'radio.1.chanbw', 'radio.1.txpower', 'wireless.1.ssid', 'wireless.1.ap', 'aaa.1.ssid', 'aaa.1.wpa.psk', 'resolv.host.1.name']);
const SETUP_VALUE = /^[A-Za-z0-9 ._@#%+=:,!^*()-]{1,63}$/;
function setupCommand(changes) {
  const exprs = [];
  Object.keys(changes).forEach((key) => {
    const value = String(changes[key]);
    if (!SETUP_KEYS.has(key)) throw new SshError('protocol', 'That setting cannot be changed by TowerDesk: ' + key);
    if (!SETUP_VALUE.test(value)) throw new SshError('protocol', 'A value for ' + key + ' has characters that are not allowed.');
    // the key is matched literally (dots escaped); the value contains none of: & \ | ' " / $ or a newline
    exprs.push("-e 's|^" + key.replace(/\./g, '\\.') + "=.*|" + key + "=" + value + "|'");
  });
  if (!exprs.length) throw new SshError('protocol', 'Nothing to change.');
  return 'sed ' + exprs.join(' ') + ' ' + CFG + ' > ' + NEWCFG + ' && cp ' + NEWCFG + ' ' + CFG + ' && rm -f ' + NEWCFG + ' && ' + APPLY + '; echo TD_APPLIED';
}
async function changeKeys(shell, changes) {
  const r = await shell.run(setupCommand(changes));
  if (!/TD_APPLIED/.test(r.out)) throw new SshError('protocol', 'The radio did not confirm the change.');
  return parseCfg((await shell.run('cat ' + CFG)).out);
}
// Read-only: the radio's running settings as key -> value.
async function readCfg(shell) {
  const cat = await shell.run('cat ' + CFG);
  const cfg = parseCfg(cat.out);
  if (cat.code !== 0 || !Object.keys(cfg).length) throw new SshError('protocol', 'The radio\'s settings file could not be read.');
  return cfg;
}

// Keep: save to flash first, and only then stop the undo job. If saving fails the job stays.
async function keep(shell) {
  const r = await shell.run('[ -f ' + PREV + ' ] || { echo TD_GONE; exit 3; }; ' + SAVE + ' || { echo TD_SAVE_FAILED; exit 4; }; kill $(cat ' + PIDF + ') 2>/dev/null; rm -f ' + PREV + ' ' + PIDF + '; echo TD_KEPT');
  if (/TD_GONE/.test(r.out)) throw new SshError('gone', 'Too late: the radio has already put the old values back.');
  if (/TD_SAVE_FAILED/.test(r.out)) throw new SshError('protocol', 'The radio could not save the settings. The undo timer is still running and will put the old values back.');
  if (!/TD_KEPT/.test(r.out)) throw new SshError('protocol', 'The radio did not confirm. The undo timer is still running.');
}

// Undo now: stop the job, put the saved running copy back and apply it.
async function undo(shell) {
  const r = await shell.run('[ -f ' + PREV + ' ] || { echo TD_GONE; exit 3; }; kill $(cat ' + PIDF + ') 2>/dev/null; cp ' + PREV + ' ' + CFG + ' && ' + APPLY + '; rm -f ' + PREV + ' ' + PIDF + '; echo TD_UNDONE');
  if (/TD_GONE/.test(r.out)) return { already: true };
  if (!/TD_UNDONE/.test(r.out)) throw new SshError('protocol', 'The radio did not confirm the undo.');
  return { already: false };
}

module.exports = { open, preflight, schedule, change, changeKeys, setupCommand, readCfg, SETUP_KEYS, keep, undo, parseCfg, SshError, CFG, PREV, PIDF, APPLY, SAVE };
