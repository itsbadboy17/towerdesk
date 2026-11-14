// Reaching a MikroTik by its MAC address THROUGH another MikroTik: SSH into the relay router, run /tool mac-telnet
// to the new router, and type a fixed list of commands there, waiting for the prompt after each one. MAC-Telnet is
// layer 2, so the relay and the new router must be on the same switch or VLAN; TowerDesk itself (behind a VPN)
// cannot do this directly.
//
// RouterOS only offers mac-telnet as an interactive command, so this is driven like a person typing: send a line,
// wait for the prompt, look at what came back. Every wait has a time limit. Passwords are never put in an error
// message or log line (they are masked out of anything that is reported).
const { Client } = require('ssh2');
const { friendlyError } = require('./common');
const model = require('../../public/macreach-model.js');

const PROMPT = /\]\s*>\s*$/;
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][0-9A-B]|\r/g;

class MacError extends Error {
  constructor(kind, message) { super(message); this.name = 'MacError'; this.kind = kind; }
}

// A tiny "expect": collects what the router prints and waits until the end of it matches a pattern.
class Expect {
  constructor(stream, secrets) {
    this.stream = stream;
    this.buf = '';
    this.secrets = (secrets || []).filter(Boolean);
    this.waiter = null;
    this.closed = false;
    stream.on('data', (d) => { this.buf += String(d).replace(ANSI, ''); if (this.buf.length > 60000) this.buf = this.buf.slice(-30000); this._check(); });
    stream.on('close', () => { this.closed = true; this._check(); });
  }
  mask(text) { return this.secrets.reduce((t, s) => t.split(s).join('••••••••'), String(text)); }
  send(line) { this.buf = ''; this.stream.write(line + '\r'); }
  _check() {
    const w = this.waiter;
    if (!w) return;
    for (let i = 0; i < w.patterns.length; i++) {
      if (w.patterns[i].test(this.buf)) { this.waiter = null; clearTimeout(w.timer); const text = this.buf; this.buf = ''; return w.resolve({ index: i, text }); }
    }
    if (this.closed) { this.waiter = null; clearTimeout(w.timer); w.reject(new MacError('closed', 'The connection closed before the router answered.')); }
  }
  waitFor(patterns, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiter = null; reject(new MacError('timeout', 'The router did not answer in time.')); }, ms || 15000);
      this.waiter = { patterns: Array.isArray(patterns) ? patterns : [patterns], resolve, reject, timer };
      this._check();
    });
  }
}

// p: { mac, user, pass, lines: [{cmd, mask?}], newPassword?, waitMs? }. Returns { done: true, sent: [masked command strings] }.
// `shell` is anything with on('data'), on('close'), write(); openRelayShell() below makes a real one.
async function run(shell, p) {
  const ex = new Expect(shell, [p.pass, p.newPassword]);
  const waitMs = p.waitMs || 15000;
  const sent = [];
  await ex.waitFor(PROMPT, waitMs).catch(() => { throw new MacError('relay', 'The relay router did not give a command prompt.'); });
  ex.send('/tool mac-telnet ' + p.mac);
  let r = await ex.waitFor([/bad command name|no such command|not enough permissions/i, /failure:|timeout|no response|could not connect|connection (closed|refused)/i, /login:\s*$/i], waitMs + 10000)
    .catch(() => { throw new MacError('mac', 'The relay did not reach that MAC address. Check that the router is on the same switch or VLAN and powered on, and that its MAC server is enabled (it is by default).'); });
  if (r.index === 0) throw new MacError('relay', 'The relay router cannot use MAC-Telnet (the tool is missing or this login may not use it).');
  if (r.index === 1) throw new MacError('mac', 'The relay did not reach that MAC address. Check that the router is on the same switch or VLAN and powered on, and that its MAC server is enabled (it is by default).');
  // "+ctw512" tells RouterOS: no colours, no terminal probing, wide lines. It makes the output predictable.
  ex.send(String(p.user || 'admin') + '+ctw512');
  await ex.waitFor(/password:\s*$/i, waitMs).catch(() => { throw new MacError('login', 'The new router did not ask for a password.'); });
  ex.send(p.pass || '');
  r = await ex.waitFor([PROMPT, /(new|repeat new) password\s*[>:]\s*$/i, /login:\s*$/i, /login failed|invalid user|wrong password/i], waitMs)
    .catch(() => { throw new MacError('login', 'The new router did not accept the login in time.'); });
  if (r.index >= 2) throw new MacError('login', 'The new router refused that username and password. Newer MikroTik models have a unique password printed on their label.');
  if (r.index === 1) {
    // some models make you choose a password the first time you log in
    if (!p.newPassword) { ex.send('\u0003'); throw new MacError('forced', 'This router asks for a new password on first login. Type the new admin password in the form and run it again.'); }
    ex.send(p.newPassword);
    r = await ex.waitFor([PROMPT, /repeat new password\s*[>:]\s*$/i], waitMs).catch(() => { throw new MacError('login', 'The router did not accept the new password.'); });
    if (r.index === 1) { ex.send(p.newPassword); await ex.waitFor(PROMPT, waitMs).catch(() => { throw new MacError('login', 'The router did not accept the new password.'); }); }
  }
  for (const l of p.lines) {
    ex.send(l.cmd);
    sent.push(model.maskLine(l));
    const out = await ex.waitFor(PROMPT, waitMs).catch(() => { throw new MacError('command', 'The router stopped answering after: ' + model.maskLine(l)); });
    if (model.ERROR_RE.test(out.text)) throw Object.assign(new MacError('command', 'The router refused: ' + model.maskLine(l) + ' (' + ex.mask(out.text.replace(/\s+/g, ' ').trim()).slice(0, 140) + ')'), { sent });
  }
  ex.send('/quit');
  await ex.waitFor([PROMPT, /disconnected|closed|bye/i], 8000).catch(() => { /* the session ending is all we wanted */ });
  return { done: true, sent };
}

// A real SSH shell on the relay router. The user name gets "+ctw512" for the same reason as above.
function openRelayShell({ host, port = 22, username, password, timeout = 10000 }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let done = false;
    const fail = (kind, err) => { if (done) return; done = true; try { conn.end(); } catch (e) { /* ignore */ } reject(new MacError(kind, typeof err === 'string' ? err : friendlyError(err))); };
    conn.on('ready', () => {
      conn.shell({ term: 'dumb', cols: 200, rows: 50 }, (err, stream) => {
        if (err) return fail('relay', err);
        done = true;
        stream.end = ((orig) => function () { try { orig.apply(this, arguments); } catch (e) { /* closed */ } try { conn.end(); } catch (e) { /* closed */ } })(stream.end);
        resolve(stream);
      });
    });
    conn.on('keyboard-interactive', (n, i, l, prompts, reply) => reply(prompts.map(() => password || '')));
    conn.on('error', (err) => fail(err && err.level === 'client-authentication' ? 'auth' : 'relay', err && err.level === 'client-authentication' ? 'The relay router refused the saved username and password over SSH.' : err));
    try {
      conn.connect({
        host, port, username: String(username || 'admin') + (String(username || '').includes('+') ? '' : '+ctw512'), password: password || '', tryKeyboard: true, readyTimeout: timeout,
        algorithms: { kex: { append: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'] }, serverHostKey: { append: ['ssh-rsa', 'ssh-dss'] }, cipher: { append: ['aes128-cbc', 'aes256-cbc', '3des-cbc'] } }
      });
    } catch (err) { fail('relay', err); }
  });
}

module.exports = { run, openRelayShell, Expect, MacError, PROMPT };
