// Reaching a MikroTik by MAC through another MikroTik. A fake RouterOS (a relay prompt, a MAC-Telnet login, and a new
// router) stands in for SSH, so these checks never touch the network.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-macreach-' + process.pid);
const assert = require('assert');
const { EventEmitter } = require('events');
const M = require('../public/macreach-model.js');
const D = require('../src/transports/mikrotik-mac');
const devices = require('../src/devices');
const provision = require('../src/provision');
const R = require('../src/macreach');

let fails = 0;
async function check(name, fn) { try { await fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

const GOOD = { mac: '4c:5e:0c:8a:1f:88', ip: '10.118.82.40', prefix: 24, gateway: '10.118.82.1', name: 'HRINS-Sm40', interface: 'ether1', factoryUser: 'admin', factoryPass: '' };

// A fake relay + new router. opts: { knownMac, user, pass, forced, failOn (regex of a command the new router refuses) }
function fakeShell(opts) {
  const sh = new EventEmitter();
  sh.state = 'relay'; sh.log = []; sh.ended = false;
  const say = (t) => setImmediate(() => sh.emit('data', t));
  sh.write = (line) => {
    const text = String(line).replace(/\r$/, '');
    sh.log.push(text);
    if (sh.state === 'relay') {
      if (/^\/tool mac-telnet /i.test(text)) {
        if (opts.noTool) return say('bad command name mac-telnet\r\n[admin@Relay] > ');
        if (text.split(' ')[2].toLowerCase() !== opts.knownMac.toLowerCase()) return say('failure: timeout\r\n[admin@Relay] > ');
        sh.state = 'login'; return say('Connecting to ' + text.split(' ')[2] + '\r\nLogin: ');
      }
      return say('[admin@Relay] > ');
    }
    if (sh.state === 'login') { sh.user = text; sh.state = 'password'; return say('Password: '); }
    if (sh.state === 'password') {
      if (sh.user.split('+')[0] !== (opts.user || 'admin') || text !== (opts.pass || '')) { sh.state = 'login'; return say('Login failed, incorrect username or password\r\nLogin: '); }
      if (opts.forced) { sh.state = 'new1'; return say('Please change your password\r\nnew password> '); }
      sh.state = 'inner'; return say('MikroTik RouterOS 7.11 (c) 1999-2023\r\n[admin@NewRouter] > ');
    }
    if (sh.state === 'new1') { sh.state = 'new2'; return say('repeat new password> '); }
    if (sh.state === 'new2') { sh.state = 'inner'; return say('[admin@NewRouter] > '); }
    if (sh.state === 'inner') {
      if (text === '/quit') { sh.state = 'relay'; return say('Session closed\r\n[admin@Relay] > '); }
      if (opts.failOn && opts.failOn.test(text)) return say('failure: already have such address\r\n[admin@NewRouter] > ');
      return say('[admin@NewRouter] > ');
    }
  };
  sh.end = () => { sh.ended = true; };
  setImmediate(() => sh.emit('data', '[admin@Relay] > '));
  return sh;
}

(async () => {
  // ---------- the rules for what is typed ----------
  await check('a good setup passes', () => assert.ok(M.validate(GOOD).ok));
  await check('the MAC address is checked and upper-cased', () => { assert.ok(M.validate(Object.assign({}, GOOD, { mac: 'nope' })).errors.mac); assert.strictEqual(M.validate(GOOD).clean.mac, '4C:5E:0C:8A:1F:88'); });
  await check('only private addresses can be given', () => { assert.ok(M.validate(Object.assign({}, GOOD, { ip: '8.8.8.8' })).errors.ip); assert.ok(M.validate(Object.assign({}, GOOD, { ip: '10.1.1.300' })).errors.ip); });
  await check('the gateway must be in the same network', () => assert.ok(M.validate(Object.assign({}, GOOD, { gateway: '10.99.0.1' })).errors.gateway));
  await check('nothing typed can add a second command', () => {
    ['ether1;/system reset-configuration', 'ether1 x', 'a"b', 'e/1'].forEach((i) => assert.ok(M.validate(Object.assign({}, GOOD, { interface: i })).errors.interface, i));
    assert.ok(M.validate(Object.assign({}, GOOD, { name: 'a;b' })).errors.name);
    assert.ok(M.validate(Object.assign({}, GOOD, { newPassword: 'pass word 123' })).errors.newPassword);
    assert.ok(M.validate(Object.assign({}, GOOD, { allowApiFrom: '10.0.0.0/24; x' })).errors.allowApiFrom);
  });
  const c = M.validate(Object.assign({}, GOOD, { newPassword: 'N3w_pass-2026', allowApiFrom: '10.118.82.0/24' })).clean;
  await check('the commands are the fixed ones, in order, and tagged so they can be undone', () => {
    const lines = M.script(c).map((l) => l.cmd);
    assert.ok(lines[0].startsWith('/ip address add address=10.118.82.40/24 interface=ether1 comment="TowerDesk setup"'));
    assert.ok(lines.some((l) => l === '/ip service set api disabled=no'));
    assert.ok(lines.some((l) => l.startsWith('/system identity set name=HRINS-Sm40')));
    assert.ok(lines[lines.length - 1].startsWith('/user set [find name=admin] password='));
    lines.filter((l) => l.startsWith('/ip address add') || l.startsWith('/ip route add') || l.startsWith('/ip firewall')).forEach((l) => assert.ok(l.includes('comment="TowerDesk setup"')));
  });
  await check('the password is masked in anything shown', () => { assert.ok(!M.script(c).map(M.maskLine).join('\n').includes('N3w_pass')); assert.ok(M.script(c).map(M.maskLine).join('\n').includes('password=••••••••')); });
  await check('the undo commands remove only what carries the TowerDesk comment', () => { const r = M.revertScript(c); assert.ok(r.every((l) => l.includes('comment="TowerDesk setup"'))); assert.ok(r.length >= 3); });

  // ---------- the driver, against the fake router ----------
  const lines = M.script(c);
  await check('it logs in through the relay and types every command, then quits', async () => {
    const sh = fakeShell({ knownMac: GOOD.mac }); const r = await D.run(sh, { mac: c.mac, user: 'admin', pass: '', lines });
    assert.ok(r.done); assert.strictEqual(r.sent.length, lines.length);
    assert.ok(sh.log[0].startsWith('/tool mac-telnet 4C:5E:0C:8A:1F:88')); assert.ok(sh.log.includes('/quit')); assert.ok(sh.log.some((l) => l.startsWith('admin+ctw512')));
    assert.ok(!r.sent.join('\n').includes('N3w_pass'));
  });
  await check('a MAC the relay cannot reach is explained', async () => { await assert.rejects(() => D.run(fakeShell({ knownMac: '00:00:00:00:00:01' }), { mac: c.mac, user: 'admin', pass: '', lines }), /did not reach that MAC/); });
  await check('a relay without the MAC-Telnet tool is explained', async () => { await assert.rejects(() => D.run(fakeShell({ knownMac: GOOD.mac, noTool: true }), { mac: c.mac, user: 'admin', pass: '', lines }), /cannot use MAC-Telnet/); });
  await check('a wrong factory password is explained, with the label hint', async () => { await assert.rejects(() => D.run(fakeShell({ knownMac: GOOD.mac, pass: 'secretlabel' }), { mac: c.mac, user: 'admin', pass: 'wrong', lines }), /unique password printed on their label/); });
  await check('a forced password change stops with a clear message unless a new password was given', async () => {
    await assert.rejects(() => D.run(fakeShell({ knownMac: GOOD.mac, forced: true }), { mac: c.mac, user: 'admin', pass: '', lines }), /asks for a new password on first login/);
    const sh = fakeShell({ knownMac: GOOD.mac, forced: true }); const r = await D.run(sh, { mac: c.mac, user: 'admin', pass: '', newPassword: 'N3w_pass-2026', lines }); assert.ok(r.done);
  });
  await check('a command the router refuses stops everything and the error hides the password', async () => {
    try { await D.run(fakeShell({ knownMac: GOOD.mac, pass: 'factory-pw-1', failOn: /identity/ }), { mac: c.mac, user: 'admin', pass: 'factory-pw-1', newPassword: 'N3w_pass-2026', lines }); assert.fail('should have refused'); }
    catch (e) { assert.strictEqual(e.kind, 'command'); assert.ok(/identity/.test(e.message)); assert.ok(!e.message.includes('factory-pw-1') && !e.message.includes('N3w_pass')); }
  });
  await check('a router that goes silent does not hang', async () => { const dead = new EventEmitter(); dead.write = () => {}; setImmediate(() => dead.emit('data', '[admin@Relay] > ')); await assert.rejects(() => D.run(dead, { mac: c.mac, user: 'admin', pass: '', lines, waitMs: 60 }), /did not reach that MAC/); });

  // ---------- plan and apply ----------
  const relay = devices.add({ name: 'Relay MikroTik', type: 'mikrotik', ip: '10.118.82.18', method: 'mikrotik', username: 'admin', password: 'relay-pw-1' }, { ok: true });
  const snmpOnly = devices.add({ name: 'SNMP only', type: 'mikrotik', ip: '10.118.82.19', method: 'snmp', community: 'public' }, { ok: true });
  // a fake MikroTik API for the relay and for the verification of the new router
  const api = { neighborRows: [{ address: '', 'mac-address': GOOD.mac, identity: 'MikroTik', platform: 'MikroTik', interface: 'ether2' }], arp: [], reachable: true };
  const tablesFor = () => ({ neighbors: api.neighborRows, arp: api.arp, hosts: [], gateway: '', selfMacs: [] });
  const mikrotik = require('../src/transports/mikrotik');
  const realRead = mikrotik.readNeighborTables;
  mikrotik.readNeighborTables = async () => tablesFor();
  let shells = [];
  const useFakes = (shellOpts) => R._use({
    openApi: async (o) => { if (o.host === '10.118.82.40') { if (!api.reachable) throw new Error('timeout'); return { run: async () => [{ name: 'HRINS-Sm40' }], close() {} }; } return { close() {} }; },
    openShell: async () => { const sh = fakeShell(shellOpts); shells.push(sh); return sh; },
    sleep: async () => {}
  });
  const body = Object.assign({}, GOOD, { relayId: relay.id });
  useFakes({ knownMac: GOOD.mac });

  await check('the preview needs a relay that is a MikroTik with the API', async () => { await assert.rejects(() => R.plan(Object.assign({}, body, { relayId: snmpOnly.id })), /MikroTik API/); await assert.rejects(() => R.plan(Object.assign({}, body, { relayId: 'nope' })), /Choose the MikroTik/); });
  await check('the preview says whether the relay sees the MAC and shows the commands, but types nothing', async () => {
    shells = []; const p = await R.plan(body); assert.ok(p.ok); assert.strictEqual(p.seen.interface, 'ether2'); assert.ok(p.commands.length >= 3); assert.strictEqual(shells.length, 0); assert.strictEqual(p.canApply, false); assert.strictEqual(p.writeOn, false);
  });
  await check('a MAC the relay does not see is flagged', async () => { api.neighborRows = []; const p = await R.plan(body); assert.strictEqual(p.seen, false); assert.ok(p.notes.some((n) => /does not see that MAC/.test(n))); api.neighborRows = [{ address: '', 'mac-address': GOOD.mac, identity: 'MikroTik', platform: 'MikroTik', interface: 'ether2' }]; });
  await check('an address already in use is flagged', async () => { api.arp = [{ address: '10.118.82.40', 'mac-address': 'AA:BB:CC:00:00:01' }]; const p = await R.plan(body); assert.ok(/already answers/.test(p.conflict)); api.arp = []; const q = await R.plan(Object.assign({}, body, { ip: '10.118.82.18' })); assert.ok(/already has a device/.test(q.conflict)); });
  await check('bad values come back as field errors, not a crash', async () => { const p = await R.plan(Object.assign({}, body, { ip: 'x' })); assert.strictEqual(p.ok, false); assert.ok(p.errors.ip); });
  await check('nothing is typed while writing is switched off', async () => { shells = []; await assert.rejects(() => R.apply(body), /switched off/); assert.strictEqual(shells.length, 0); });

  provision.setAllowWrite(true);
  await check('with writing on, it types the commands and checks the new router answers', async () => {
    shells = []; api.reachable = true; const r = await R.apply(Object.assign({}, body, { newPassword: 'N3w_pass-2026' }));
    assert.ok(r.ok && r.verified); assert.strictEqual(r.ip, '10.118.82.40'); assert.strictEqual(r.identity, 'HRINS-Sm40');
    assert.ok(shells[0].log.some((l) => l.startsWith('/ip address add'))); assert.ok(!JSON.stringify(r).includes('N3w_pass'));
  });
  await check('if the new router cannot be reached afterwards, the address is taken back', async () => {
    shells = []; api.reachable = false;
    await assert.rejects(() => R.apply(body), /cannot reach the router at 10\.118\.82\.40/);
    const undo = shells[shells.length - 1].log; assert.ok(undo.some((l) => /^\/ip address remove \[find comment="TowerDesk setup"\]/.test(l)));
    api.reachable = true;
  });
  await check('if the router refuses a command, TowerDesk tries to take back what it had added', async () => {
    shells = []; useFakes({ knownMac: GOOD.mac, failOn: /identity/ });
    await assert.rejects(() => R.apply(body), /refused: \/system identity set/);
    assert.ok(shells.length >= 2 && shells[shells.length - 1].log.some((l) => /^\/ip address remove/.test(l)));
    useFakes({ knownMac: GOOD.mac });
  });
  await check('a device that already has that address is refused before anything is typed', async () => { shells = []; await assert.rejects(() => R.apply(Object.assign({}, body, { ip: '10.118.82.18' })), /already has a device/); assert.strictEqual(shells.length, 0); });

  mikrotik.readNeighborTables = realRead;
  if (fails) { console.log('\n' + fails + ' macreach test(s) failed'); process.exit(1); }
  console.log('Macreach tests passed.');
})();
