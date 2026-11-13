// One-click apply on a Ubiquiti airOS radio over SSH, against a simulated radio that has what
// matters for safety: a running copy of the settings (/tmp) and a saved copy (flash). The tests
// prove the ordering and the guarantees, not that real airOS firmware behaves the same - that
// still has to be tried once on a real radio (the screen says so).
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('ssh2');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-airos-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const devices = require('../src/devices');
const radio = require('../src/radio');
const airosSsh = require('../src/transports/airos-ssh');

let failed = 0;
function ok(name, cond) { console.log((cond ? 'pass  ' : 'FAIL  ') + name); if (!cond) failed++; }

const USER = 'ubnt', PASS = 'pw-' + crypto.randomBytes(4).toString('hex');
const BASE = { 'radio.1.freq': '5180', 'radio.1.txpower': '24', 'radio.1.chanbw': '20', 'wireless.1.ssid': 'TestNet' };
const toText = (c) => Object.keys(c).map((k) => k + '=' + c[k]).join('\n') + '\n';

// ---- the simulated radio ----
const R = { running: null, flash: null, prev: null, job: null, log: [], softrestarts: 0, tools: true, ignoreApply: false, failSave: false, extra: {} };
function reset() { R.running = Object.assign({}, BASE, R.extra); R.flash = Object.assign({}, BASE, R.extra); R.prev = null; R.job = null; R.log = []; R.softrestarts = 0; R.tools = true; R.ignoreApply = false; R.failSave = false; }
function fireJob() { if (R.job) { R.running = Object.assign({}, R.prev); R.prev = null; R.job = null; R.softrestarts++; } } // the radio's own timer
function reboot() { R.running = Object.assign({}, R.flash); R.prev = null; R.job = null; }                           // /tmp is lost, flash stays

function handle(cmd) {
  R.log.push(cmd);
  if (cmd === 'cat /tmp/system.cfg') return [toText(R.running), 0];
  if (cmd.startsWith('test -x "$(command -v cfgmtd)"')) return [R.tools ? 'TD_TOOLS_OK\n' : '', R.tools ? 0 : 1];
  if (cmd.startsWith('test ! -e /tmp/towerdesk-prev.cfg')) return [R.prev ? '' : 'TD_CLEAN\n', R.prev ? 1 : 0];
  if (cmd === 'cp /tmp/system.cfg /tmp/towerdesk-prev.cfg && echo TD_BACKUP_OK') { R.prev = Object.assign({}, R.running); return ['TD_BACKUP_OK\n', 0]; }
  if (cmd.startsWith('nohup sh -c \'')) { R.job = cmd; return ['TD_SCHEDULED\n', 0]; }
  if (cmd.startsWith('sed ')) {
    if (R.ignoreApply) return ['', 1];
    const next = Object.assign({}, R.running);
    const re = /s\/\^radio\\\.1\\\.(freq|txpower)=\.\*\/radio\.1\.\1=(\d+)\//g;
    let m; while ((m = re.exec(cmd))) next['radio.1.' + m[1]] = m[2];
    R.running = next; R.softrestarts++;
    return ['TD_APPLIED\n', 0];
  }
  if (cmd.includes('TD_KEPT')) {
    if (!R.prev) return ['TD_GONE\n', 3];
    if (R.failSave) return ['TD_SAVE_FAILED\n', 4];
    R.flash = Object.assign({}, R.running); R.job = null; R.prev = null;
    return ['TD_KEPT\n', 0];
  }
  if (cmd.includes('TD_UNDONE')) {
    if (!R.prev) return ['TD_GONE\n', 3];
    R.running = Object.assign({}, R.prev); R.job = null; R.prev = null; R.softrestarts++;
    return ['TD_UNDONE\n', 0];
  }
  return ['', 127];
}

function fakeRadio() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  return new Server({ hostKeys: [privateKey] }, (client) => {
    client.on('authentication', (ctx) => (ctx.method === 'password' && ctx.username === USER && ctx.password === PASS ? ctx.accept() : ctx.reject(['password'])));
    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept();
        session.on('exec', (acceptExec, reject, info) => {
          const stream = acceptExec();
          const [out, code] = handle(info.command);
          if (out) stream.write(out);
          stream.exit(code);
          stream.end();
        });
      });
    });
    client.on('error', () => {});
  });
}

const change = (setting, to, from) => ({ setting, to, from, applicable: true, label: setting, unit: setting === 'frequency' ? 'MHz' : 'dBm' });
const failsWith = async (fn, re) => { try { await fn(); return false; } catch (e) { return re.test(e.message); } };

async function main() {
  const srv = fakeRadio();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const dev = devices.add({ name: 'Ubiquiti sector', type: 'ubnt', ip: '127.0.0.1', method: 'airos', username: USER, password: PASS }, { ok: true });
  devices.update(dev.id, { sshPort: port });
  const bad = devices.add({ name: 'Wrong login', type: 'ubnt', ip: '127.0.0.1', method: 'airos', username: USER, password: 'nope' }, { ok: true });
  devices.update(bad.id, { sshPort: port });
  const shut = devices.add({ name: 'No SSH', type: 'ubnt', ip: '127.0.0.1', method: 'airos', username: USER, password: PASS }, { ok: true });
  devices.update(shut.id, { sshPort: 1 });

  try {
    ok('airOS radios can be changed (marked experimental), MikroTik not experimental', radio.capabilities({ method: 'airos' }).length === 2 && radio.experimental({ method: 'airos' }) === true && radio.experimental({ method: 'mikrotik' }) === false);
    ok('other radios still cannot', radio.capabilities({ method: 'mimosa' }).length === 0 && /set the values on its own page/.test(radio.whyNot({ method: 'mimosa' })));

    // ---- read-only check ----
    reset();
    let pf = await radio.preflight(dev);
    ok('preflight reads the radio and changes nothing', pf.ok && pf.frequency === 5180 && pf.txPower === 24 && R.log.every((c) => /^(cat |test )/.test(c)) && R.softrestarts === 0);
    R.tools = false; pf = await radio.preflight(dev);
    ok('preflight: missing tools is reported', !pf.ok && /tools/.test(pf.problems[0]));
    reset(); R.running = { 'wireless.1.ssid': 'x' }; pf = await radio.preflight(dev);
    ok('preflight: an unknown settings layout is reported', !pf.ok && /somewhere TowerDesk does not recognise/.test(pf.problems.join(' ')));
    reset(); R.prev = { a: '1' }; pf = await radio.preflight(dev);
    ok('preflight: a leftover earlier change is reported', !pf.ok && /still waiting/.test(pf.problems[0]));
    pf = await radio.preflight(bad);
    ok('preflight: wrong SSH login gives a plain message', !pf.ok && /refused the SSH login/.test(pf.problems[0]));
    pf = await radio.preflight(shut);
    ok('preflight: SSH turned off gives a plain message', !pf.ok && /Turn SSH on/.test(pf.problems[0]));

    // ---- apply: safety net first, nothing saved ----
    reset();
    let st = await radio.apply(dev, [change('frequency', 5240, 5180), change('txPower', 22, 24)]);
    ok('new values are running on the radio', R.running['radio.1.freq'] === '5240' && R.running['radio.1.txpower'] === '22' && R.softrestarts === 1);
    const iBackup = R.log.findIndex((c) => /TD_BACKUP_OK/.test(c)), iJob = R.log.findIndex((c) => c.startsWith('nohup')), iSed = R.log.findIndex((c) => c.startsWith('sed'));
    ok('backup and the radio\'s own undo timer come before the change', iBackup > -1 && iJob > iBackup && iSed > iJob);
    ok('NOTHING is saved to flash yet', R.flash['radio.1.freq'] === '5180' && R.flash['radio.1.txpower'] === '24');
    ok('the undo timer restores the running copy and never writes flash', /sleep 300/.test(R.job) && /cp \/tmp\/towerdesk-prev\.cfg \/tmp\/system\.cfg/.test(R.job) && !/cfgmtd/.test(R.job));
    ok('status shows what changed and when it reverts', st && st.applied.length === 2 && st.secondsLeft > 0 && st.secondsLeft <= 300 && st.applied[0].from === 5180);
    ok('a second change waits for Keep or Undo', await failsWith(() => radio.apply(dev, [change('frequency', 5260, 5240)]), /still waiting/));

    // a reboot while waiting brings the old settings back by itself
    reboot();
    ok('a reboot at this point restores the old settings (they were never saved)', R.running['radio.1.freq'] === '5180' && R.running['radio.1.txpower'] === '24');
    radio._pending.clear();

    // ---- keep: saved only now ----
    reset();
    await radio.apply(dev, [change('frequency', 5240, 5180)]);
    await radio.keep(dev);
    ok('keep saves to flash and cancels the undo timer', R.flash['radio.1.freq'] === '5240' && R.job === null && R.prev === null && radio.status(dev.id) === null);

    // ---- undo now ----
    reset();
    await radio.apply(dev, [change('frequency', 5300, 5180), change('txPower', 20, 24)]);
    await radio.undo(dev);
    ok('undo restores the old values, cancels the timer, saves nothing', R.running['radio.1.freq'] === '5180' && R.running['radio.1.txpower'] === '24' && R.job === null && R.flash['radio.1.freq'] === '5180' && radio.status(dev.id) === null);

    // ---- the radio undoes it by itself; Keep afterwards is refused ----
    reset();
    await radio.apply(dev, [change('frequency', 5320, 5180)]);
    fireJob();
    ok('the radio puts the old values back when the timer fires', R.running['radio.1.freq'] === '5180');
    ok('Keep after the radio reverted is refused and nothing is saved', await failsWith(() => radio.keep(dev), /already put the old values back/) && R.flash['radio.1.freq'] === '5180');
    radio._pending.clear();

    // ---- keep fails to save: the undo timer stays ----
    reset();
    await radio.apply(dev, [change('frequency', 5320, 5180)]);
    R.failSave = true;
    ok('if saving fails the owner is told the timer is still running', await failsWith(() => radio.keep(dev), /undo timer is still running/));
    ok('and the timer really is still there', R.job !== null && R.prev !== null && radio.status(dev.id) !== null);
    R.failSave = false; await radio.undo(dev);

    // ---- guards before anything is touched ----
    reset();
    ok('a frequency that moved since the proposal is refused', await failsWith(() => radio.apply(dev, [change('frequency', 5240, 5200)]), /not 5200/));
    ok('an unknown power reading is refused', await failsWith(() => radio.apply(dev, [change('txPower', 20, null)]), /counts transmit power differently/));
    ok('power the radio counts differently is refused', await failsWith(() => radio.apply(dev, [change('txPower', 20, 23)]), /counts transmit power differently/));
    ok('refusals touched nothing on the radio', !R.log.some((c) => /TD_BACKUP_OK|^nohup|^sed/.test(c)) && R.prev === null && R.job === null);
    R.tools = false;
    ok('missing tools stop the change before anything is written', await failsWith(() => radio.apply(dev, [change('frequency', 5240, 5180)]), /tools/) && !R.log.some((c) => /^nohup|^sed/.test(c)));

    // ---- the radio does not take the change: rolled back ----
    reset(); R.ignoreApply = true;
    ok('a change the radio does not confirm is rolled back', await failsWith(() => radio.apply(dev, [change('frequency', 5240, 5180)]), /rolled back/));
    ok('and leaves no timer, no pending state, old values running', R.job === null && R.prev === null && R.running['radio.1.freq'] === '5180' && radio.status(dev.id) === null);

    // ---- wrong login / no SSH on apply ----
    reset();
    ok('wrong SSH login: refused with a plain message, nothing changed', await failsWith(() => radio.apply(bad, [change('frequency', 5240, 5180)]), /refused the SSH login/) && R.log.length === 0);
    ok('SSH off: refused with a plain message', await failsWith(() => radio.apply(shut, [change('frequency', 5240, 5180)]), /Turn SSH on/));

    // ---- values placed in commands are whole numbers only ----
    const sh = await airosSsh.open({ host: '127.0.0.1', port, username: USER, password: PASS });
    reset();
    let threw = false; try { await airosSsh.change(sh, { frequency: '5240; reboot' }); } catch (e) { threw = true; }
    ok('a value that is not a plain number never reaches a command', threw && !R.log.some((c) => /reboot/.test(c)));
    sh.close();
  } finally {
    srv.close();
  }
}

main().catch((e) => { console.log('FAIL  threw: ' + (e && e.stack || e)); failed++; }).then(() => {
  if (failed) { console.log(failed + ' airOS apply test(s) failed.'); process.exit(1); }
  console.log('airOS apply tests passed.');
  process.exit(0);
});
