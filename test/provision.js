// Setting up a radio: what is accepted, what the preview says, and how a write is protected. A fake radio stands in for SSH,
// so these checks never touch the network.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-provision-' + process.pid);
const assert = require('assert');
const M = require('../public/provision-model.js');
const realSsh = require('../src/transports/airos-ssh');
const P = require('../src/provision');

let fails = 0;
async function check(name, fn) { try { await fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

const GOOD = { name: 'HRINS-Su20', ssid: 'HRINS-Su20', wpaKey: 'S3cret_key-2026', frequency: 5745, channelWidth: 20, txPower: 22 };
const CFG = { 'radio.1.mode': 'Managed', 'radio.1.freq': '5180', 'radio.1.chanbw': '40', 'radio.1.txpower': '20', 'wireless.1.ssid': 'ubnt', 'aaa.1.ssid': 'ubnt', 'aaa.1.wpa.psk': 'oldpassword', 'resolv.host.1.name': 'ubnt', 'users.1.password': 'HASH' };

// a radio in memory: records every command, starts from CFG
function fakeRadio(opts) {
  opts = opts || {};
  const radio = { cfg: Object.assign({}, CFG), log: [], saved: false, undone: false, scheduled: false };
  radio.ssh = {
    open: async (o) => { if (opts.badLogin) { const e = new Error('bad'); e.kind = 'auth'; throw e; } radio.log.push('open'); return { close() {} }; },
    readCfg: async () => Object.assign({}, radio.cfg),
    preflight: async () => ({ ok: !opts.badPreflight, problems: opts.badPreflight ? ['The radio is missing the tools needed to apply and save settings safely.'] : [] }),
    schedule: async () => { radio.scheduled = true; radio.log.push('schedule'); },
    changeKeys: async (shell, changes) => { radio.log.push('change'); if (opts.refuse) return Object.assign({}, radio.cfg); Object.assign(radio.cfg, changes); return Object.assign({}, radio.cfg); },
    undo: async () => { radio.undone = true; radio.log.push('undo'); radio.cfg = Object.assign({}, CFG); return { already: false }; },
    keep: async () => { radio.saved = true; radio.log.push('keep'); },
    SETUP_KEYS: realSsh.SETUP_KEYS
  };
  return radio;
}

(async () => {
  await check('a good sector template passes', () => assert.ok(M.validate('sector', GOOD).ok));
  await check('an SSID with a quote is refused', () => assert.ok(M.validate('sector', Object.assign({}, GOOD, { ssid: 'my"net' })).errors.ssid));
  await check('a Wi-Fi password that is too short or has a slash is refused', () => { assert.ok(M.validate('sector', Object.assign({}, GOOD, { wpaKey: 'short' })).errors.wpaKey); assert.ok(M.validate('sector', Object.assign({}, GOOD, { wpaKey: 'abcdefgh/ijk' })).errors.wpaKey); });
  await check('numbers are checked: frequency, width, power', () => { const e = M.validate('sector', Object.assign({}, GOOD, { frequency: 12, channelWidth: 7, txPower: 99 })).errors; assert.ok(e.frequency && e.channelWidth && e.txPower); });
  await check('a customer radio needs a name, an SSID and a password, but not a channel', () => { assert.ok(M.validate('customer', { name: 'C1', ssid: 'HRINS', wpaKey: 'longenough1' }).ok); assert.ok(M.validate('customer', { name: 'C1' }).errors.ssid); });
  await check('a MAC lock must look like a MAC', () => { assert.ok(M.validate('customer', { name: 'C1', ssid: 'X', wpaKey: 'longenough1', lockAp: 'nope' }).errors.lockAp); assert.ok(M.validate('customer', { name: 'C1', ssid: 'X', wpaKey: 'longenough1', lockAp: '78:8A:20:AA:BB:CC' }).ok); });
  await check('fields that are not part of the template are ignored', () => assert.strictEqual(M.validate('customer', Object.assign({}, GOOD, { name: 'C1' })).clean.frequency, undefined));
  await check('an unknown template is refused', () => assert.ok(M.validate('toaster', GOOD).errors._));

  const clean = M.validate('sector', GOOD).clean;
  const plan = M.airosPlan('sector', clean, CFG);
  await check('the preview marks what changes and what is the same', () => { assert.strictEqual(plan.rows.find((r) => r.key === 'radio.1.freq').status, 'change'); assert.strictEqual(M.airosPlan('sector', { name: 'ubnt' }, CFG).rows.find((r) => r.key === 'resolv.host.1.name').status, 'same'); });
  await check('a sector is an access point, a customer radio is a station', () => { assert.strictEqual(plan.rows.find((r) => r.key === 'radio.1.mode').value, 'Master'); assert.strictEqual(M.airosPlan('customer', M.validate('customer', { name: 'C', ssid: 'X', wpaKey: 'longenough1' }).clean, CFG).rows.find((r) => r.key === 'radio.1.mode').value, 'Managed'); });
  await check('the password is never shown in the preview', () => { const r = plan.rows.find((x) => x.key === 'aaa.1.wpa.psk'); assert.strictEqual(r.to, '••••••••'); assert.strictEqual(r.from, '••••••••'); assert.ok(!JSON.stringify(plan.rows.map((x) => [x.from, x.to])).includes('S3cret')); assert.ok(!JSON.stringify(plan.rows.map((x) => [x.from, x.to])).includes('oldpassword')); });
  await check('the SSID is written in both places the radio keeps it', () => assert.strictEqual(plan.rows.filter((r) => r.field === 'ssid').length, 2));
  await check('a setting the radio does not have is reported and never added', () => { const p = M.airosPlan('sector', clean, { 'radio.1.mode': 'Master', 'radio.1.freq': '5180', 'radio.1.chanbw': '40', 'radio.1.txpower': '20', 'wireless.1.ssid': 'x', 'aaa.1.ssid': 'x', 'resolv.host.1.name': 'x' }); assert.ok(p.problems.some((t) => /Wi-Fi password/.test(t))); assert.ok(!p.changes.some((r) => r.key === 'aaa.1.wpa.psk')); });
  await check('the admin password and other keys are not on the allowed list', () => { assert.ok(!M.AIROS_ALLOWED.includes('users.1.password')); assert.ok(!realSsh.SETUP_KEYS.has('users.1.password')); M.AIROS_ALLOWED.forEach((k) => assert.ok(realSsh.SETUP_KEYS.has(k), k + ' is planned but the radio layer would refuse it')); });
  await check('the command refuses quotes, slashes and unknown keys', () => { assert.throws(() => realSsh.setupCommand({ 'wireless.1.ssid': "a'b" })); assert.throws(() => realSsh.setupCommand({ 'wireless.1.ssid': 'a/b' })); assert.throws(() => realSsh.setupCommand({ 'system.x': '1' })); const cmd = realSsh.setupCommand({ 'wireless.1.ssid': 'HRINS' }); assert.ok(cmd.includes("'s|^wireless\\.1\\.ssid=.*|wireless.1.ssid=HRINS|'")); assert.ok(cmd.includes('/tmp/system.cfg')); });
  await check('the MikroTik preview hides the password and needs no login', () => { const c = M.mikrotikPreview('sector', clean).join('\n'); assert.ok(c.includes('mode=ap-bridge')); assert.ok(!c.includes('S3cret')); });

  await check('writing is off until an admin switches it on', async () => { assert.strictEqual(P.settings().allowWrite, false); await assert.rejects(() => P.apply({ host: '192.168.1.20', template: 'sector', values: GOOD }), /switched off/); });
  await check('a plan needs a valid IP and valid values', async () => { assert.ok((await P.plan({ host: 'nope', template: 'sector', values: GOOD })).error); assert.ok((await P.plan({ host: '192.168.1.20', template: 'sector', values: { name: '' } })).errors); });
  await check('a plan reads the radio and changes nothing', async () => { const r = fakeRadio(); P._useSsh(r.ssh); const p = await P.plan({ host: '192.168.1.20', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }); assert.ok(p.ok); assert.ok(p.changes >= 5); assert.strictEqual(p.canApply, false); assert.deepStrictEqual(r.log.filter((l) => l !== 'open'), []); });
  await check('a wrong login says so in plain words', async () => { P._useSsh(fakeRadio({ badLogin: true }).ssh); await assert.rejects(() => P.plan({ host: '192.168.1.20', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }), /refused that username/); });
  await check('a MikroTik plan is a preview only', async () => { const p = await P.plan({ host: '192.168.88.1', brand: 'mikrotik', template: 'sector', values: GOOD }); assert.ok(p.ok); assert.strictEqual(p.canApply, false); assert.ok(p.commands.length >= 2); });

  P.setAllowWrite(true);
  await check('switching writing on is remembered', () => assert.strictEqual(P.settings().allowWrite, true));
  await check('an apply starts the undo timer BEFORE it changes anything', async () => { const r = fakeRadio(); P._useSsh(r.ssh); const a = await P.apply({ host: '192.168.1.21', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }); assert.ok(a.ok); assert.deepStrictEqual(r.log.filter((l) => l !== 'open'), ['schedule', 'change']); assert.strictEqual(r.cfg['wireless.1.ssid'], 'HRINS-Su20'); assert.strictEqual(r.cfg['users.1.password'], 'HASH'); assert.strictEqual(r.saved, false); });
  await check('Keep saves it and ends the wait', async () => { const r = fakeRadio(); P._useSsh(r.ssh); await P.apply({ host: '192.168.1.22', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }); assert.strictEqual(P.status('192.168.1.22').waiting, true); await P.keep('192.168.1.22'); assert.strictEqual(r.saved, true); assert.strictEqual(P.status('192.168.1.22').waiting, false); });
  await check('Undo puts the old settings back', async () => { const r = fakeRadio(); P._useSsh(r.ssh); await P.apply({ host: '192.168.1.23', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }); await P.undo('192.168.1.23'); assert.strictEqual(r.undone, true); assert.strictEqual(r.cfg['wireless.1.ssid'], 'ubnt'); });
  await check('a radio that did not take the values is rolled back', async () => { const r = fakeRadio({ refuse: true }); P._useSsh(r.ssh); await assert.rejects(() => P.apply({ host: '192.168.1.24', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }), /rolled back/); assert.strictEqual(r.undone, true); assert.strictEqual(P.status('192.168.1.24').waiting, false); });
  await check('a radio missing its tools is left alone', async () => { const r = fakeRadio({ badPreflight: true }); P._useSsh(r.ssh); await assert.rejects(() => P.apply({ host: '192.168.1.25', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }), /missing the tools/); assert.deepStrictEqual(r.log.filter((l) => l !== 'open'), []); });
  await check('nothing to change is not an error that touches the radio', async () => { const r = fakeRadio(); r.cfg = Object.assign(r.cfg, { 'radio.1.mode': 'Master', 'radio.1.freq': '5745', 'radio.1.chanbw': '20', 'radio.1.txpower': '22', 'wireless.1.ssid': 'HRINS-Su20', 'aaa.1.ssid': 'HRINS-Su20', 'aaa.1.wpa.psk': 'S3cret_key-2026', 'resolv.host.1.name': 'HRINS-Su20' }); P._useSsh(r.ssh); await assert.rejects(() => P.apply({ host: '192.168.1.26', username: 'ubnt', password: 'x', template: 'sector', values: GOOD }), /Nothing to change/); assert.ok(!r.log.includes('schedule')); });
  await check('MikroTik apply is refused for now', async () => { await assert.rejects(() => P.apply({ host: '192.168.88.1', brand: 'mikrotik', template: 'sector', values: GOOD }), /not available yet/); });
  await check('Keep with nothing waiting says so', async () => { P._useSsh(fakeRadio().ssh); await assert.rejects(() => P.keep('192.168.9.9'), /nothing waiting/); });

  if (fails) { console.log('\n' + fails + ' provision test(s) failed'); process.exit(1); }
  console.log('Provision tests passed.');
})();
