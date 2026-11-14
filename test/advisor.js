// Sector advisor: the built-in diagnosis, what is (and is not) sent to the AI, the limits on
// proposed changes, and the apply / keep / undo path against a fake MikroTik radio.
const assert = require('node:assert');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-adv-'));
process.env.TOWERDESK_DATA_DIR = tmp;
process.env.TOWERDESK_CLAUDE_BIN = path.join(tmp, 'no-claude-here.js'); // nothing to find: the earlier tests must not touch a real Claude Code

const advisor = require('../src/advisor');
const radio = require('../src/radio');
const devices = require('../src/devices');
const { encodeSentence, parseSentences } = require('../src/transports/mikrotik');

let failed = 0;
function ok(name, cond) {
  console.log((cond ? 'pass  ' : 'FAIL  ') + name);
  if (!cond) failed++;
}

// ---- a sector with a mix of clients ----
const sectorDevice = (over) => Object.assign({
  id: 's1', name: 'Sector Secret Name', type: 'mikrotik', location: 'Hill tower', role: 'sector',
  lastTest: { details: { model: 'RB911' } },
  metrics: {
    ccq: 82, cpu: { now: 20 }, stationCount: 5,
    radio: { freq: '5180 MHz', chanbw: 20, txpower: 24, noise: -92 },
    stations: [
      { name: 'ali@isp', mac: 'AA:BB:CC:DD:EE:01', ip: '10.5.5.20', signal: -78, ccq: 62, txRate: 52, rxRate: 40, txBps: 4e6, rxBps: 1e6 },
      { name: 'sara@isp', mac: 'AA:BB:CC:DD:EE:02', ip: '10.5.5.21', signal: -75, ccq: 58, txRate: 58, rxRate: 52, txBps: 2e6, rxBps: 5e5 },
      { name: 'omar@isp', mac: 'AA:BB:CC:DD:EE:03', ip: '10.5.5.22', signal: -60, ccq: 55, txRate: 130, rxRate: 120, txBps: 1e6, rxBps: 2e5 },
      { name: 'noor@isp', mac: 'AA:BB:CC:DD:EE:04', ip: '10.5.5.23', signal: -58, ccq: 61, txRate: 130, rxRate: 120, txBps: 1e6, rxBps: 2e5 },
      { name: 'lina@isp', mac: 'AA:BB:CC:DD:EE:05', ip: '10.5.5.24', signal: -64, ccq: 90, txRate: 130, rxRate: 120, txBps: 1e6, rxBps: 2e5 }
    ]
  }
}, over || {});
const other = { id: 'bh', name: 'Backhaul Secret', role: 'backhaul', location: 'hill tower', metrics: { radio: { freq: '5200 MHz', chanbw: 40 } } };
const far = { id: 'x', name: 'Far', role: 'sector', location: 'Other site', metrics: { radio: { freq: '5745 MHz', chanbw: 20 } } };

// ---- diagnosis (offline) ----
const ctx = advisor.context(sectorDevice(), [sectorDevice(), other, far], ['frequency', 'txPower']);
const codes = advisor.diagnose(ctx).map((f) => f.code);
ok('weak clients found', codes.includes('few-weak') || codes.includes('many-weak'));
ok('good signal + low CCQ flagged as interference', codes.includes('interference'));
ok('overlap with an own radio on the same tower flagged', codes.includes('overlap'));
ok('no overlap flag for a distant frequency', advisor.diagnose(ctx).filter((f) => f.code === 'overlap').length === 1);
ok('empty sector says so', advisor.diagnose(advisor.context(sectorDevice({ metrics: { radio: {}, stations: [] } }), [], [])).some((f) => f.code === 'no-clients'));
const healthy = sectorDevice();
healthy.metrics.stations = healthy.metrics.stations.map((c) => Object.assign({}, c, { signal: -62, ccq: 95 }));
ok('healthy sector reports healthy', advisor.diagnose(advisor.context(healthy, [], [])).some((f) => f.code === 'healthy'));

// ---- privacy: nothing identifying goes into the snapshot ----
const wire = JSON.stringify(ctx);
ok('no usernames in the snapshot', !/ali@isp|sara@isp|omar@isp/.test(wire));
ok('no MAC or IP addresses in the snapshot', !/AA:BB:CC|10\.5\.5\./i.test(wire));
ok('no device names in the snapshot', !/Secret/.test(wire));
ok('clients are numbered', ctx.clients[0].label === 'client 1' && ctx.neighbours[0].label === 'radio A');

// ---- limits on proposed changes ----
const S = (over) => advisor.sanitize(ctx, [].concat(over));
ok('frequency inside the band is allowed', S({ setting: 'frequency', to: 5240 }).length === 1);
ok('frequency outside the band is dropped', S({ setting: 'frequency', to: 2437 }).length === 0);
ok('same frequency is dropped', S({ setting: 'frequency', to: 5180 }).length === 0);
ok('fractional frequency is dropped', S({ setting: 'frequency', to: 5240.5 }).length === 0);
ok('power can go down', S({ setting: 'txPower', to: 20 }).length === 1);
ok('power cannot jump up by more than 3', S({ setting: 'txPower', to: 28 }).length === 0);
ok('power above the legal ceiling is dropped', S({ setting: 'txPower', to: 40 }).length === 0);
ok('unknown setting is dropped', S({ setting: 'ssid', to: 1 }).length === 0);
ok('junk value is dropped', S({ setting: 'frequency', to: 'abc' }).length === 0);
ok('channel width is shown but never applicable', (S({ setting: 'channelWidth', to: 40 })[0] || {}).applicable === false);
ok('one change per setting', S([{ setting: 'frequency', to: 5240 }, { setting: 'frequency', to: 5260 }]).length === 1);
ok('applicable only when this radio can be changed', advisor.sanitize(advisor.context(sectorDevice(), [], []), [{ setting: 'frequency', to: 5240 }])[0].applicable === false);

// ---- channel suggestions ----
const plan = advisor.channelPlan(ctx);
ok('the current channel is reported with what it overlaps', plan.current.frequencyMHz === 5180 && plan.current.overlaps.indexOf('radio A') > -1);
ok('every suggestion keeps clear of your own radios', plan.options.length > 0 && plan.options.every((o) => !o.overlaps && o.clearanceMHz >= 0));
ok('suggestions stay in the 5 GHz range and never repeat the current channel', plan.options.every((o) => o.frequencyMHz >= 5180 && o.frequencyMHz <= 5825 && o.frequencyMHz !== 5180));
ok('the nearest of your radios is named for each suggestion', plan.options.every((o) => /^radio /.test(o.nearest)));
ok('the plan says what it cannot see', /other networks/.test(plan.note));
const pick = plan.options[0];
const chg = advisor.channelChange(ctx, pick.frequencyMHz);
ok('a suggested channel becomes a change that passes the limits', !!chg && advisor.sanitize(ctx, [chg]).length === 1 && /clear of radio/.test(chg.reason));
ok('a channel that was not suggested is refused', advisor.channelChange(ctx, 5200) === null);
ok('a radio with no frequency gets no suggestions', advisor.channelPlan(advisor.context(sectorDevice({ metrics: { radio: {}, stations: [] } }), [], [])).options.length === 0);
const lone = advisor.channelPlan(advisor.context(sectorDevice(), [sectorDevice()], []));
ok('with none of your other radios near, every channel is free and it says so', lone.options.length > 0 && /equally free/.test(lone.note));
const band24 = advisor.channelPlan(advisor.context(sectorDevice({ metrics: { radio: { freq: '2437 MHz', chanbw: 20 }, stations: [] } }), [], []));
ok('2.4 GHz suggests channels 1 and 11', band24.options.map((o) => o.frequencyMHz).sort().join() === '2412,2462');

// ---- asking Claude, with a fake client ----
async function ai() {
  let seen = null;
  let reply;
  advisor._setClientFactory((key) => ({ beta: { messages: { create: async (req) => { seen = { key, req }; return reply; } } } }));
  const good = {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: 'sector_advice', input: {
      summary: 'Two clients are weak and one channel overlaps.', causes: ['Overlap with radio A.'], manual: ['Realign client 1.'], confidence: 'medium',
      changes: [
        { setting: 'frequency', to: 5260, reason: 'Clears radio A.', risk: 'Clients reconnect.' },
        { setting: 'frequency', to: 2412, reason: 'wrong band', risk: 'x' },
        { setting: 'txPower', to: 60, reason: 'too loud', risk: 'x' }
      ] } }]
  };

  let r = await advisor.advise(sectorDevice(), [sectorDevice(), other], { canApply: ['frequency', 'txPower'], useAi: true });
  ok('no key saved: says so, still gives the built-in findings', /No AI key/.test(r.aiError) && r.findings.length > 0 && seen === null);

  advisor.setConfig({ key: 'sk-ant-test-1234567890' });
  ok('key is stored encrypted and not returned', advisor.getConfig().hasKey === true && !fs.readFileSync(path.join(tmp, 'ai.json'), 'utf8').includes('sk-ant-test'));

  reply = good;
  r = await advisor.advise(sectorDevice(), [sectorDevice(), other], { canApply: ['frequency', 'txPower'], useAi: true, lang: 'ar' });
  ok('the saved key is what the client was built with', seen && seen.key === 'sk-ant-test-1234567890');
  ok('uses claude-opus-5-5 with the refusal fallback and one forced-free tool', seen.req.model === 'claude-opus-5-5' && seen.req.fallbacks === 'default' && seen.req.tools.length === 1 && !seen.req.tool_choice);
  const sent = JSON.stringify(seen.req);
  ok('what is sent has no names, MACs or IPs', !/ali@isp|AA:BB:CC|10\.5\.5\.|Secret|sk-ant-test/i.test(sent));
  ok('language is requested', /Arabic/.test(seen.req.system));
  ok('AI summary and causes come back', r.ai && /weak/.test(r.ai.summary) && r.ai.causes.length === 1 && r.ai.manual.length === 1 && r.ai.confidence === 'medium');
  ok('only the valid change survives the limits', r.changes.length === 1 && r.changes[0].setting === 'frequency' && r.changes[0].to === 5260 && r.changes[0].applicable === true);
  ok('a proposal id is issued for the shown changes', !!r.proposalId && !!advisor.proposal(r.proposalId, 's1'));
  ok('a proposal belongs to its own sector only', advisor.proposal(r.proposalId, 'other-sector') === null);
  advisor.forget(r.proposalId);
  ok('a used proposal is gone', advisor.proposal(r.proposalId, 's1') === null);

  reply = { stop_reason: 'refusal', content: [] };
  r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: true });
  ok('a refusal is reported, not crashed on', /declined/.test(r.aiError) && r.changes.length === 0);
  reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'hello' }] };
  r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: true });
  ok('no tool call is reported', /unexpected form/.test(r.aiError));
  reply = { stop_reason: 'max_tokens', content: [] };
  r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: true });
  ok('a cut-off answer is reported', /cut short/.test(r.aiError));
  advisor._setClientFactory(() => ({ beta: { messages: { create: async () => { throw new Error('boom sk-ant-test-1234567890'); } } } }));
  r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: true });
  ok('a failure is reported without echoing the key', !!r.aiError && !/sk-ant-test-1234567890/.test(JSON.stringify(r)));
  r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: false });
  ok('without the AI switch nothing is asked', r.ai === null && r.aiError === null);
  advisor.setConfig({ clearKey: true });
  ok('key can be removed', advisor.getConfig().hasKey === false);
}


// ---- Claude Code on this PC, used when no key is saved (a stand-in program, no real call) ----
async function claudeCode() {
  const fake = path.join(__dirname, 'fake-claude.js');
  const log = path.join(tmp, 'fake-claude.log');
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : []);
  process.env.TOWERDESK_CLAUDE_BIN = fake;
  process.env.FAKE_LOG = log;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-in-the-parent-environment';
  const run = (mode, extra) => { process.env.FAKE_MODE = mode; advisor.setConfig({ clearKey: true }); return advisor.advise(sectorDevice(), [sectorDevice(), other], Object.assign({ canApply: ['frequency', 'txPower'], useAi: true }, extra || {})); };
  try {
    advisor._resetStatusCache(); process.env.FAKE_LOGGED = '1';
    let st = await advisor.status();
    ok('settings shows Claude Code found and signed in', st.claudeCode.found && st.claudeCode.loggedIn === true && st.hasKey === false);
    advisor._resetStatusCache(); process.env.FAKE_LOGGED = '0';
    st = await advisor.status();
    ok('settings shows it found but not signed in, with the sign-in command', st.claudeCode.found && st.claudeCode.loggedIn === false && /auth login/.test(st.claudeCode.command) && st.claudeCode.command.indexOf(fake) > -1);

    let r = await run('structured');
    ok('no key: the advisor asks Claude Code and says so', r.via === 'claude-code' && r.ai && /overlaps/.test(r.ai.summary) && r.aiError === null);
    ok('its proposed change goes through the same limits', r.changes.length === 1 && r.changes[0].to === 5260 && r.changes[0].applicable === true && !!r.proposalId);
    const c = calls().filter((x) => x.args[0] === '-p').pop();
    ok('it runs with no tools, no saved session and a JSON answer', c.args.indexOf('--tools') > -1 && c.args[c.args.indexOf('--tools') + 1] === '' && c.args.includes('--no-session-persistence') && c.args[c.args.indexOf('--output-format') + 1] === 'json');
    const schema = JSON.parse(c.args[c.args.indexOf('--json-schema') + 1]);
    ok('it is given the answer schema', schema.required.includes('summary') && schema.properties.changes.type === 'array');
    ok('it runs in an empty temporary folder, not the project', c.cwd !== process.cwd() && c.cwd.startsWith(os.tmpdir()) && !fs.existsSync(c.cwd));
    ok('a stray API key in the environment is not passed on', c.keyInEnv === false);
    ok('what it is sent has no names, MACs or IPs', !/ali@isp|AA:BB:CC|10\.5\.5\.|Secret/i.test(c.stdin) && /client 1/.test(c.stdin));
    ok('the system prompt asks for JSON only', /JSON object/.test(c.args[c.args.indexOf('--system-prompt') + 1]));

    r = await run('fenced');
    ok('an answer wrapped in a code fence is read', r.via === 'claude-code' && r.ai && r.changes.length === 1);
    r = await run('notlogged');
    ok('not signed in: says so and gives the command', /not signed in/.test(r.aiError) && /auth login/.test(r.aiError) && r.ai === null);
    r = await run('apierror');
    ok('another Claude Code error is passed on plainly', /Claude Code could not answer: Overloaded/.test(r.aiError));
    r = await run('garbage');
    ok('an answer with no JSON is reported', /unexpected form/.test(r.aiError));
    r = await run('nojson');
    ok('output that is not JSON is reported', /could not be run/.test(r.aiError));
    process.env.TOWERDESK_CLAUDE_TIMEOUT_MS = '600';
    r = await run('hang');
    ok('a Claude Code that never answers times out', /did not answer in time/.test(r.aiError));
    delete process.env.TOWERDESK_CLAUDE_TIMEOUT_MS;

    // a saved key wins; Claude Code is not used then
    const before = calls().length;
    advisor.setConfig({ key: 'sk-ant-test-1234567890' });
    advisor._setClientFactory(() => ({ beta: { messages: { create: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'sector_advice', input: { summary: 'From the API.', causes: [], manual: [], changes: [], confidence: 'high' } }] }) } } }));
    process.env.FAKE_MODE = 'structured';
    r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: true });
    ok('with a key saved the API is used and Claude Code is left alone', r.via === 'api' && /From the API/.test(r.ai.summary) && calls().length === before);
    advisor._setClientFactory(null);
    advisor.setConfig({ clearKey: true });

    // nothing at all
    process.env.TOWERDESK_CLAUDE_BIN = path.join(tmp, 'no-claude-here.js');
    advisor._resetStatusCache();
    r = await advisor.advise(sectorDevice(), [], { canApply: [], useAi: true });
    ok('no key and no Claude Code: says what to do', /No AI key saved.*Claude Code/.test(r.aiError));
    st = await advisor.status();
    ok('settings shows no Claude Code when there is none', st.claudeCode.found === false);
  } finally {
    delete process.env.ANTHROPIC_API_KEY; delete process.env.FAKE_MODE; delete process.env.FAKE_LOGGED; delete process.env.FAKE_LOG;
    process.env.TOWERDESK_CLAUDE_BIN = path.join(tmp, 'no-claude-here.js');
  }
}

// ---- a stateful fake MikroTik wireless router ----
const rt = { freq: '5180', width: '20/40mhz-Ce', power: '20', mode: 'default', sched: [], log: [], refuse: false };
function fakeRouter() {
  return net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on('error', () => {});
    const done = (...rows) => sock.write(Buffer.concat(rows.map((r) => encodeSentence(r)).concat([encodeSentence(['!done'])])));
    const word = (s, k) => { const w = s.find((x) => x.startsWith('=' + k + '=')); return w ? w.slice(k.length + 2) : undefined; };
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const { sentences, rest } = parseSentences(buf);
      buf = rest;
      for (const s of sentences) {
        const cmd = s[0];
        if (cmd !== '/login') rt.log.push(cmd);
        if (cmd === '/login') done();
        else if (cmd === '/interface/wireless/print') done(['!re', '=.id=*1', '=name=wlan1', '=mode=ap-bridge', '=disabled=false', '=frequency=' + rt.freq, '=band=5ghz-a/n', '=channel-width=' + rt.width, '=tx-power=' + rt.power, '=tx-power-mode=' + rt.mode, '=ssid=TestNet']);
        else if (cmd === '/system/scheduler/print') done(...rt.sched.map((e) => ['!re', '=.id=' + e.id, '=name=' + e.name]));
        else if (cmd === '/system/scheduler/add') { rt.sched.push({ id: '*S' + (rt.sched.length + 1), name: word(s, 'name'), onEvent: word(s, 'on-event') }); done(); }
        else if (cmd === '/system/scheduler/remove') { rt.sched = rt.sched.filter((e) => e.id !== word(s, '.id')); done(); }
        else if (cmd === '/interface/wireless/set') {
          if (rt.refuse) { sock.write(encodeSentence(['!trap', '=message=failure: not allowed'])); sock.write(encodeSentence(['!done'])); continue; }
          if (word(s, 'frequency') !== undefined) rt.freq = word(s, 'frequency');
          if (word(s, 'tx-power') !== undefined) rt.power = word(s, 'tx-power');
          if (word(s, 'tx-power-mode') !== undefined) rt.mode = word(s, 'tx-power-mode');
          done();
        } else done();
      }
    });
  });
}

async function applying() {
  const srv = fakeRouter();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const dev = devices.add({ name: 'Radio', type: 'mikrotik', ip: '127.0.0.1', method: 'mikrotik', port, username: 'admin', password: 'pw-test-1' }, { ok: true });
  const change = (setting, to, from, applicable) => ({ setting, to, from, applicable: applicable !== false, label: setting, unit: setting === 'frequency' ? 'MHz' : 'dBm' });
  try {
    ok('MikroTik and airOS radios can be changed, others cannot', radio.capabilities({ method: 'mikrotik' }).length === 2 && radio.capabilities({ method: 'airos' }).length === 2 && radio.capabilities({ method: 'mimosa' }).length === 0 && radio.capabilities({ method: 'snmp' }).length === 0);
    let threw = false;
    try { await radio.apply({ id: 'z', method: 'mimosa' }, [change('frequency', 5240, 5180)]); } catch (e) { threw = true; }
    ok('a radio that cannot be changed is refused', threw);
    threw = false;
    try { await radio.apply(dev, [change('frequency', 5240, 5180, false)]); } catch (e) { threw = /Nothing to apply/.test(e.message); }
    ok('a change that is not applicable is refused', threw);
    threw = false;
    try { await radio.apply(dev, [change('channelWidth', 40, 20)]); } catch (e) { threw = true; }
    ok('channel width is never written', threw && rt.width === '20/40mhz-Ce');

    // apply -> the router's own undo entry exists first, then the change
    let st = await radio.apply(dev, [change('frequency', 5240, 5180), change('txPower', 18, 20)]);
    ok('values were set', rt.freq === '5240' && rt.power === '18' && rt.mode === 'all-rates-fixed');
    ok('the undo entry was created before the change', rt.log.indexOf('/system/scheduler/add') < rt.log.indexOf('/interface/wireless/set'));
    ok('the undo entry restores the old values on the router itself', rt.sched.length === 1 && rt.sched[0].name === radio.SCHED && /frequency=5180/.test(rt.sched[0].onEvent) && /tx-power-mode=default/.test(rt.sched[0].onEvent) && /scheduler remove/.test(rt.sched[0].onEvent));
    ok('status shows what changed and when it reverts', st && st.applied.length === 2 && st.secondsLeft > 0 && st.secondsLeft <= radio.REVERT_MIN * 60);
    threw = false;
    try { await radio.apply(dev, [change('frequency', 5260, 5240)]); } catch (e) { threw = /still waiting/.test(e.message); }
    ok('a second change waits for Keep or Undo', threw);

    // keep -> undo entry removed, values stay
    await radio.keep(dev);
    ok('keep removes the undo entry and leaves the values', rt.sched.length === 0 && rt.freq === '5240' && radio.status(dev.id) === null);

    // second round: undo puts the old values back
    rt.freq = '5180'; rt.power = '20'; rt.mode = 'default';
    await radio.apply(dev, [change('frequency', 5300, 5180)]);
    ok('applied again', rt.freq === '5300' && rt.sched.length === 1);
    await radio.undo(dev);
    ok('undo restores the old values and removes the undo entry', rt.freq === '5180' && rt.power === '20' && rt.mode === 'default' && rt.sched.length === 0 && radio.status(dev.id) === null);

    // the router refuses -> nothing is left behind
    rt.refuse = true;
    threw = false;
    try { await radio.apply(dev, [change('frequency', 5320, 5180)]); } catch (e) { threw = /refused the change/.test(e.message); }
    ok('a refused change is reported and leaves no undo entry', threw && rt.sched.length === 0 && radio.status(dev.id) === null);
    rt.refuse = false;

    // expiry: after the router's own revert time TowerDesk stops claiming it is pending
    await radio.apply(dev, [change('frequency', 5320, 5180)]);
    radio._pending.get(dev.id).revertAt = Date.now() - 1000;
    ok('an expired change reads as already reverted', (radio.status(dev.id) || {}).expired === true);
    threw = false;
    try { await radio.keep(dev); } catch (e) { threw = true; }
    ok('keeping after the revert time is refused', threw);

    // the history records every step, newest first, and never a password
    const radioHistory = require('../src/radio-history');
    const hist = radioHistory.list(dev.id, 20);
    const acts = hist.map((e) => e.action);
    ok('history records apply, keep, undo and the radio reverting by itself', ['applied', 'kept', 'undone', 'expired'].every((a) => acts.indexOf(a) > -1));
    ok('history keeps the values before and after', hist.some((e) => e.action === 'applied' && e.changes.some((c) => c.setting === 'frequency' && c.from === 5180 && c.to === 5240)));
    ok('history never holds a password', JSON.stringify(hist).indexOf('pw-test-1') === -1);
    ok('history is newest first', hist.every((e, i) => i === 0 || hist[i - 1].t >= e.t));
    const first = hist.find((e) => e.action === 'applied');
    ok('an entry can be found again by its time', radioHistory.find(dev.id, first.t).t === first.t && radioHistory.find('other', first.t) === null);
    ok('junk entries are not recorded', radioHistory.add({ deviceId: 'x', action: 'bogus', changes: [{ setting: 'frequency', to: 1 }] }) === null && radioHistory.add({ deviceId: 'x', action: 'applied', changes: [{ setting: 'ssid', to: 1 }] }) === null);
    radioHistory.forget(dev.id);
    ok('history can be forgotten with the device', radioHistory.list(dev.id).length === 0);
  } finally {
    srv.close();
  }
}

ai().then(claudeCode).then(applying).catch((e) => { console.log('FAIL  threw: ' + (e && e.stack || e)); failed++; }).then(() => {
  if (failed) { console.log(failed + ' advisor test(s) failed.'); process.exit(1); }
  console.log('Advisor tests passed.');
  process.exit(0);
});
