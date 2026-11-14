// "Lab data": the lab runs as its own TowerDesk with its own data folder, and can never be the real one.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-lab-' + process.pid, 'data');
delete process.env.TOWERDESK_LAB;
const assert = require('assert');
const { EventEmitter } = require('events');
const path = require('path');
const lab = require('../src/lab');
const { dataDir } = require('../src/paths');

let fails = 0;
async function check(name, fn) { try { await fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

function fakeSpawn() {
  const calls = [];
  const spawn = (cmd, args, opts) => { const k = new EventEmitter(); k.killed = false; k.kill = () => { k.killed = true; k.emit('exit'); }; calls.push({ cmd, args, opts, kid: k }); return k; };
  return { spawn, calls };
}

(async () => {
  await check('by default the lab has a folder of its own next to the real one, on its own port', () => {
    const c = lab.config(); assert.ok(c.dataDir.toLowerCase() !== dataDir().toLowerCase()); assert.ok(c.dataDir.endsWith('-lab')); assert.strictEqual(c.port, 3001); assert.strictEqual(c.mockSas, true);
  });
  await check('the real data folder is refused as the lab folder', () => assert.ok(lab.setConfig({ dataDir: dataDir() }).error));
  await check('a port outside the normal range, or TowerDesk\'s own, is refused', () => { assert.ok(lab.setConfig({ port: 80 }).error); assert.ok(lab.setConfig({ port: 3000 }).error); assert.ok(lab.setConfig({ port: 'x' }).error); });
  await check('a good folder and port are saved', () => { const r = lab.setConfig({ dataDir: path.join(path.dirname(dataDir()), 'my-lab'), port: 3055, mockSas: false }); assert.ok(r.ok); assert.strictEqual(lab.config().port, 3055); assert.strictEqual(lab.config().mockSas, false); });
  await check('when nothing answers, the lab is stopped', async () => {
    lab._use({ probe: async () => ({ answers: false, lab: false }), listening: async () => false });
    const s = await lab.status(); assert.strictEqual(s.running, false); assert.strictEqual(s.blocked, null);
  });
  await check('something else on the lab port is never opened as the lab', async () => {
    lab._use({ probe: async () => ({ answers: true, lab: false }), listening: async () => true });
    const s = await lab.status(); assert.strictEqual(s.running, false); assert.ok(/not marked as the lab/.test(s.blocked));
    assert.ok((await lab.start()).error);
  });
  await check('a TowerDesk that says it is the lab counts as running', async () => {
    lab._use({ probe: async () => ({ answers: true, lab: true }), listening: async () => true });
    const s = await lab.status(); assert.strictEqual(s.running, true); assert.strictEqual(s.ready, true);
  });

  lab.setConfig({ dataDir: path.join(path.dirname(dataDir()), 'my-lab'), port: 3056, mockSas: true });
  await check('starting runs a second TowerDesk with its own data, localhost only, marked as the lab', async () => {
    const f = fakeSpawn(); lab._use({ spawn: f.spawn, probe: async () => ({ answers: false, lab: false }), listening: async () => false });
    const r = await lab.start(); assert.ok(r.ok);
    const lc = f.calls[0]; assert.ok(lc.args[0].endsWith('server.js'));
    assert.strictEqual(lc.opts.env.TOWERDESK_LAB, '1'); assert.strictEqual(lc.opts.env.PORT, '3056'); assert.strictEqual(lc.opts.env.TOWERDESK_HOST, '127.0.0.1');
    assert.ok(lc.opts.env.TOWERDESK_DATA_DIR.endsWith('my-lab')); assert.notStrictEqual(lc.opts.env.TOWERDESK_DATA_DIR.toLowerCase(), dataDir().toLowerCase());
    assert.ok(/localhost:\d+/.test(lc.opts.env.TOWERDESK_MAIN_URL)); assert.strictEqual(lc.opts.env.TOWERDESK_DEMO, undefined);
    assert.ok(f.calls[1].args[0].endsWith('mock-sas4.js'), 'the pretend SAS is started too');
    assert.ok(require('fs').existsSync(lc.opts.env.TOWERDESK_DATA_DIR), 'the data folder was created');
    await lab.stop();
  });
  await check('an already running lab is not started twice, and the pretend SAS is not duplicated', async () => {
    const f = fakeSpawn(); lab._use({ spawn: f.spawn, probe: async () => ({ answers: true, lab: true }), listening: async () => true });
    assert.ok((await lab.start()).ok); assert.strictEqual(f.calls.length, 0);
  });
  await check('stopping ends what was started and nothing else', async () => {
    const f = fakeSpawn(); lab._use({ spawn: f.spawn, probe: async () => ({ answers: false, lab: false }), listening: async () => false });
    await lab.start(); const kids = f.calls.map((c) => c.kid); const r = await lab.stop(); assert.ok(r.stopped); assert.ok(kids.every((k) => k.killed));
    assert.strictEqual((await lab.stop()).stopped, false);
  });
  await check('inside the lab itself, starting a lab is refused', async () => {
    process.env.TOWERDESK_LAB = '1'; try { assert.ok((await lab.start()).error); } finally { delete process.env.TOWERDESK_LAB; }
  });

  if (fails) { console.log('\n' + fails + ' lab test(s) failed'); process.exit(1); }
  console.log('Lab tests passed.');
})();
