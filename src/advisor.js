// Sector advisor: reads what TowerDesk already knows about one sector, says what looks wrong
// (built-in rules, offline), and — only when the owner has saved an API key and asks for it —
// has Claude explain it and propose setting changes.
//
// Nothing here changes a radio. Proposed changes are checked against hard limits, kept on the
// server, and can only be applied through radio.js after the owner has seen and accepted them.
//
// Privacy: customer names, usernames, MAC and IP addresses never leave the PC. Clients are sent
// as "client 1", "client 2"…, other radios as "radio A", "radio B"….
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const storage = require('./storage');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'ai.json');
const MODEL = 'claude-opus-5-5';
const MAX_CLIENTS = 80;
const PROPOSAL_TTL_MS = 15 * 60 * 1000;

// ---- settings (data/ai.json): the API key, encrypted at rest and never returned ----
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } }
function getConfig() { return { hasKey: !!load().key }; }
// What the Settings page shows: the key, and whether Claude Code on this PC can stand in for it.
async function status() { return Object.assign(getConfig(), { claudeCode: await claudeCodeStatus() }); }
function setConfig(input) {
  const cur = load();
  const key = String((input && input.key) || '').trim().slice(0, 400);
  const next = {};
  if (key) next.key = storage.encrypt(key);
  else if (cur.key && !(input && input.clearKey)) next.key = cur.key;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  return getConfig();
}
function savedKey() { const c = load(); try { return c.key ? storage.decrypt(c.key) : ''; } catch (e) { return ''; } }

// ---- context: the anonymised picture of one sector ----
function mhz(v) { const m = /(\d{4,5})/.exec(String(v === undefined || v === null ? '' : v)); return m ? Number(m[1]) : null; }
function n(v) { return v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); }

function context(device, allDevices, canApply) {
  const mx = device.metrics || {};
  const r = mx.radio || {};
  const stations = (mx.stations || []).slice(0, MAX_CLIENTS);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const neighbours = (allDevices || [])
    .filter((d) => d.id !== device.id && d.metrics && d.metrics.radio && mhz(d.metrics.radio.freq))
    .slice(0, 24)
    .map((d, i) => ({
      label: 'radio ' + (letters[i] || i + 1),
      role: d.role || 'device',
      frequencyMHz: mhz(d.metrics.radio.freq),
      channelWidthMHz: n(d.metrics.radio.chanbw),
      sameLocation: !!(device.location && d.location && String(d.location).trim().toLowerCase() === String(device.location).trim().toLowerCase())
    }));
  return {
    sector: {
      vendor: device.type, model: (device.lastTest && device.lastTest.details && device.lastTest.details.model) || null,
      frequencyMHz: mhz(r.freq), channelWidthMHz: n(r.chanbw), txPowerDbm: n(r.txpower),
      noiseFloorDbm: n(r.noise), ccqPct: n(r.ccq !== undefined ? r.ccq : mx.ccq),
      cpuPct: mx.cpu ? n(mx.cpu.now) : null, clientCount: mx.stationCount || stations.length
    },
    clients: stations.map((c, i) => ({
      label: 'client ' + (i + 1), signalDbm: n(c.signal), ccqPct: n(c.ccq), txRateMbps: n(c.txRate), rxRateMbps: n(c.rxRate),
      downKbps: c.txBps == null ? null : Math.round(c.txBps / 1000), upKbps: c.rxBps == null ? null : Math.round(c.rxBps / 1000)
    })),
    neighbours,
    canApply: canApply || []
  };
}

// ---- built-in diagnosis (no AI, no internet) ----
const T = { weak: -73, veryWeak: -80, lowCcq: 70, noisy: -88, strong: -55 };

function diagnose(ctx) {
  const out = [];
  const add = (severity, code, text, data) => out.push({ severity, code, text, data: data || {} });
  const s = ctx.sector, cl = ctx.clients;
  if (!cl.length) { add('info', 'no-clients', 'No clients are connected to this sector right now, so there is little to judge.'); return out; }
  const withSig = cl.filter((c) => c.signalDbm !== null);
  const weak = withSig.filter((c) => c.signalDbm <= T.weak);
  const lowCcq = cl.filter((c) => c.ccqPct !== null && c.ccqPct < T.lowCcq);
  const goodSigBadCcq = lowCcq.filter((c) => c.signalDbm !== null && c.signalDbm > T.weak);
  if (withSig.length && weak.length / withSig.length >= 0.5 && withSig.length >= 3) {
    add('warning', 'many-weak', weak.length + ' of ' + withSig.length + ' clients have a weak signal (' + T.weak + ' dBm or lower). When most clients are weak the cause is usually at the sector: antenna aim, tilt, a bad cable or too little power.', { count: weak.length });
  } else if (weak.length) {
    add('warning', 'few-weak', weak.length + ' client' + (weak.length > 1 ? 's have' : ' has') + ' a weak signal (' + weak.map((c) => c.label + ' ' + c.signalDbm + ' dBm').slice(0, 6).join(', ') + '). With only a few weak clients the cause is usually at the client: alignment, distance or an obstacle.', { count: weak.length });
  }
  if (goodSigBadCcq.length >= 2 || (goodSigBadCcq.length && goodSigBadCcq.length / cl.length >= 0.3)) {
    add('warning', 'interference', goodSigBadCcq.length + ' client' + (goodSigBadCcq.length > 1 ? 's have' : ' has') + ' a good signal but low CCQ. Good signal with poor quality points to interference on this channel.', { count: goodSigBadCcq.length });
  }
  if (s.noiseFloorDbm !== null && s.noiseFloorDbm > T.noisy) {
    add('warning', 'noise', 'The noise floor is ' + s.noiseFloorDbm + ' dBm, which is high. Something else is transmitting on or near this channel.');
  }
  if (s.frequencyMHz) {
    const w = s.channelWidthMHz || 20;
    ctx.neighbours.forEach((nb) => {
      const gap = Math.abs(nb.frequencyMHz - s.frequencyMHz);
      const need = (w + (nb.channelWidthMHz || 20)) / 2;
      if (gap < need) add(nb.sameLocation ? 'warning' : 'info', 'overlap', 'This sector (' + s.frequencyMHz + ' MHz, ' + w + ' MHz wide) overlaps your own ' + nb.label + ' (' + nb.frequencyMHz + ' MHz' + (nb.sameLocation ? ', same location' : '') + '). Radios you own should not share spectrum, least of all on one tower.', { label: nb.label, frequencyMHz: nb.frequencyMHz });
    });
  }
  if (s.txPowerDbm !== null && withSig.length >= 3 && withSig.every((c) => c.signalDbm >= T.strong)) {
    add('info', 'hot', 'Every client is at ' + T.strong + ' dBm or stronger. The sector is louder than it needs to be; lower power means less interference for your other radios.');
  }
  if (s.cpuPct !== null && s.cpuPct >= 85) add('warning', 'cpu', 'The sector CPU is at ' + s.cpuPct + '%. A radio that busy drops throughput no matter how good the signal is.');
  if (!out.length) add('ok', 'healthy', 'Nothing stands out: signals, CCQ and channel look normal for ' + cl.length + ' clients.');
  return out;
}

// ---- hard limits on what may ever be proposed for one-click apply ----
function band(f) { return f >= 2400 && f <= 2500 ? [2400, 2500] : (f >= 4900 && f <= 6100 ? [4900, 6100] : null); }

function checkChange(ctx, ch) {
  const s = ctx.sector;
  const setting = String(ch.setting || '');
  const to = Number(ch.to);
  const base = { setting, to, reason: String(ch.reason || '').slice(0, 400), risk: String(ch.risk || '').slice(0, 300) };
  if (!Number.isFinite(to)) return null;
  if (setting === 'frequency') {
    const cur = s.frequencyMHz;
    const b = cur ? band(cur) : null;
    if (!Number.isInteger(to) || !b || to < b[0] || to > b[1] || to === cur) return null;
    return Object.assign(base, { label: 'Frequency', unit: 'MHz', from: cur, applicable: ctx.canApply.includes('frequency') });
  }
  if (setting === 'txPower') {
    const cur = s.txPowerDbm;
    if (!Number.isInteger(to) || to < 3 || to > 27 || to === cur) return null;
    if (cur !== null && to > cur + 3) return null; // never a big jump up in one go
    return Object.assign(base, { label: 'Transmit power', unit: 'dBm', from: cur, applicable: ctx.canApply.includes('txPower') });
  }
  if (setting === 'channelWidth') {
    if (![5, 10, 20, 30, 40, 50, 60, 80].includes(to) || to === s.channelWidthMHz) return null;
    return Object.assign(base, { label: 'Channel width', unit: 'MHz', from: s.channelWidthMHz, applicable: false });
  }
  return null;
}
function sanitize(ctx, changes) {
  const seen = new Set();
  return (Array.isArray(changes) ? changes : []).map((c) => checkChange(ctx, c)).filter((c) => {
    if (!c || seen.has(c.setting)) return false;
    seen.add(c.setting);
    return true;
  });
}

// ---- channel suggestions (no AI, no scan: judged only from the owner's own radios) ----
const GUARD_MHZ = 5;
function channelPlan(ctx) {
  const s = ctx.sector, cur = s.frequencyMHz, bw = s.channelWidthMHz || 20;
  const note = 'This looks only at your own radios. TowerDesk cannot see other networks or the noise on each channel, so check the radio\'s own site survey before you commit.';
  if (!cur) return { current: null, options: [], note: 'This radio does not report its frequency, so channels cannot be suggested.' };
  const band5 = cur >= 5000 && cur <= 5900, band24 = cur >= 2400 && cur <= 2500;
  if (!band5 && !band24) return { current: { frequencyMHz: cur, widthMHz: bw }, options: [], note: 'Channel suggestions cover the 2.4 and 5 GHz bands.' };
  const near = ctx.neighbours.filter((nb) => Math.abs(nb.frequencyMHz - cur) < 700);
  const clearanceAt = (f) => {
    let min = null, who = null;
    near.forEach((nb) => {
      const c = Math.abs(f - nb.frequencyMHz) - (bw + (nb.channelWidthMHz || 20)) / 2 - GUARD_MHZ;
      if (min === null || c < min) { min = c; who = nb.label; }
    });
    return { clearance: min, nearest: who };
  };
  let freqs = [];
  if (band24) freqs = [2412, 2437, 2462];
  else {
    // The usual 5180-5825 range, stretched to cover any frequency the owner's own radios already
    // use (some radios run outside it), so a sector on 5880 is not offered only far-away channels.
    const own = ctx.neighbours.map((nb) => nb.frequencyMHz).filter((f) => f >= 5000 && f <= 5900).concat([cur]);
    const lo = Math.min(5180, Math.min.apply(null, own)), hi = Math.max(5825, Math.max.apply(null, own));
    for (let k = -60; k <= 60; k++) { const f = cur + k * 20; if (f >= lo && f <= hi) freqs.push(f); }
  }
  freqs = freqs.filter((f) => f !== cur);
  const rows = freqs.map((f) => {
    const c = clearanceAt(f);
    return { frequencyMHz: f, clearanceMHz: c.clearance === null ? null : Math.round(c.clearance), nearest: c.nearest, moveMHz: f - cur, overlaps: c.clearance !== null && c.clearance < 0 };
  });
  // A gap beyond 25 MHz adds nothing; a long move costs something (the radio may not allow it, and
  // clients have to follow). So a nearby channel with a decent gap beats a distant one.
  const score = (r) => (r.clearanceMHz === null ? 25 : Math.min(r.clearanceMHz, 25)) - Math.abs(r.moveMHz) / 10;
  rows.sort((a, b) => score(b) - score(a));
  const clear = rows.filter((r) => !r.overlaps).slice(0, 6);
  const here = clearanceAt(cur);
  return {
    current: { frequencyMHz: cur, widthMHz: bw, overlaps: near.filter((nb) => Math.abs(cur - nb.frequencyMHz) - (bw + (nb.channelWidthMHz || 20)) / 2 - GUARD_MHZ < 0).map((nb) => nb.label), clearanceMHz: here.clearance === null ? null : Math.round(here.clearance) },
    options: clear.length ? clear : rows.slice(0, 3),
    allOverlap: !clear.length && rows.length > 0,
    neighbours: near.length,
    note: near.length ? note : 'None of your other radios report a frequency near this one, so every channel looks equally free. ' + note
  };
}
// The change that moves a sector to one of the suggested channels.
function channelChange(ctx, frequencyMHz) {
  const plan = channelPlan(ctx);
  const o = plan.options.find((x) => x.frequencyMHz === Number(frequencyMHz));
  if (!o) return null;
  return { setting: 'frequency', to: o.frequencyMHz, reason: o.nearest && o.clearanceMHz !== null ? 'Stays ' + o.clearanceMHz + ' MHz clear of ' + o.nearest + ' (your own radio).' : 'None of your own radios is near this channel.', risk: 'Clients reconnect; allow about a minute. Other networks nearby were not checked.' };
}

// ---- Claude ----
const TOOL = {
  name: 'sector_advice',
  description: 'Report the diagnosis of this wireless sector and any setting changes worth making.',
  strict: true,
  input_schema: {
    type: 'object', additionalProperties: false,
    required: ['summary', 'causes', 'changes', 'manual', 'confidence'],
    properties: {
      summary: { type: 'string', description: 'Two or three plain sentences for the tower owner: what is going on and how serious it is.' },
      causes: { type: 'array', items: { type: 'string' }, description: 'Most likely causes, most likely first. Each one sentence.' },
      changes: {
        type: 'array',
        description: 'Setting changes on the sector radio itself. Empty when the data does not justify one.',
        items: {
          type: 'object', additionalProperties: false, required: ['setting', 'to', 'reason', 'risk'],
          properties: {
            setting: { type: 'string', enum: ['frequency', 'txPower', 'channelWidth'] },
            to: { type: 'number', description: 'New value: MHz for frequency and channelWidth, dBm for txPower.' },
            reason: { type: 'string', description: 'One sentence: which numbers in the data lead to this.' },
            risk: { type: 'string', description: 'One sentence: what could get worse.' }
          }
        }
      },
      manual: { type: 'array', items: { type: 'string' }, description: 'Things a person has to do by hand: realign a client, check a cable, do a site survey. Refer to clients by their label.' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
    }
  }
};

function systemPrompt(lang, asJson) {
  return [
    'You are helping the owner of a small wireless ISP look after one point-to-multipoint sector on a tower. They are a hands-on operator, not an RF engineer. They will read your answer in a dashboard and may apply your proposed changes to a live radio that serves paying customers, so a wrong change has a real cost: every customer on the sector drops.',
    'You get a JSON snapshot: the sector radio settings, its connected clients (anonymised as "client N"), the owner\'s other radios with their frequencies (anonymised as "radio X"), and the findings of simple built-in rules. That snapshot is all you know. You have no spectrum scan, so you cannot see interference from radios the owner does not own; you can only reason from noise floor, CCQ against signal, and overlap with the owner\'s own radios.',
    'Propose a setting change only when the numbers in the snapshot support it, and say which numbers. When the evidence is thin, propose no change and put the checking step (for example a site survey from the radio\'s own tools at a quiet hour) under manual instead. A frequency move must stay in the same band, must not overlap any of the owner\'s other radios given both channel widths, and should be the smallest move that clears the overlap. Change transmit power in small steps. Problems that affect only a few clients are almost always at the client end and belong under manual, not under changes.',
    (asJson ? 'Reply with one JSON object that matches the schema you were given and nothing else: no prose before or after it, no code fence. Write every text field in ' : 'Call the sector_advice tool exactly once with your answer and write nothing else. Write every text field in ') + (lang === 'ar' ? 'Arabic' : 'English') + ', in short plain sentences; keep units, numbers and the labels "client N" / "radio X" as they are.'
  ].join('\n\n');
}

let clientFactory = null; // tests inject a fake
function _setClientFactory(fn) { clientFactory = fn; }

function makeClient(apiKey) {
  if (clientFactory) return { client: clientFactory(apiKey), sdk: null };
  let sdk;
  try { sdk = require('@anthropic-ai/sdk'); }
  catch (e) { throw new Error('The AI part is not in this copy. Download the full TowerDesk zip once to get it.'); }
  const Anthropic = sdk.default || sdk.Anthropic || sdk;
  return { client: new Anthropic({ apiKey, maxRetries: 1, timeout: 120000 }), sdk: Anthropic };
}

// Returns { summary, causes, changes, manual, confidence }. Throws an Error with a message fit
// to show the owner (never containing the key).
async function askClaude(ctx, findings, lang) {
  const key = savedKey();
  if (!key) throw new Error('No AI key saved. Add one in Settings.');
  const { client, sdk } = makeClient(key);
  let res;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(lang),
      tools: [TOOL],
      messages: [{ role: 'user', content: JSON.stringify({ snapshot: ctx, builtInFindings: findings.map((f) => f.text) }) }]
    });
  } catch (err) {
    if (sdk) {
      if (err instanceof sdk.AuthenticationError) throw new Error('The AI key was refused. Check it in Settings.');
      if (err instanceof sdk.PermissionDeniedError) throw new Error('This AI key is not allowed to use the model.');
      if (err instanceof sdk.RateLimitError) throw new Error('The AI service is busy or the key is out of quota. Try again in a minute.');
      if (err instanceof sdk.APIConnectionError) throw new Error('Could not reach the AI service. Check the internet connection.');
      if (err instanceof sdk.APIError) throw new Error('The AI service answered with an error (' + (err.status || 'unknown') + ').');
    }
    // Whatever the failure says, the key must not reach the screen or a log.
    const safe = String((err && err.message) || 'error').split(key).join('[key]').replace(/sk-ant-[\w-]+/g, '[key]');
    throw new Error('Could not get AI advice: ' + safe.slice(0, 160));
  }
  if (res.stop_reason === 'refusal') throw new Error('The AI declined to answer this request.');
  if (res.stop_reason === 'max_tokens') throw new Error('The AI answer was cut short. Try again.');
  const call = (res.content || []).find((b) => b.type === 'tool_use' && b.name === 'sector_advice');
  if (!call || !call.input || typeof call.input !== 'object') throw new Error('The AI answered in an unexpected form. Try again.');
  return normalizeAdvice(call.input);
}

function normalizeAdvice(a) {
  const strs = (v, max) => (Array.isArray(v) ? v : []).map((x) => String(x).slice(0, 500)).filter(Boolean).slice(0, max);
  return {
    summary: String(a.summary || '').slice(0, 1200),
    causes: strs(a.causes, 6),
    changes: Array.isArray(a.changes) ? a.changes : [],
    manual: strs(a.manual, 10),
    confidence: ['low', 'medium', 'high'].includes(a.confidence) ? a.confidence : 'low'
  };
}

// ---- Claude Code on this PC (used when no API key is saved) ----
// The Claude desktop app carries its own copy of Claude Code. If that copy is signed in, the
// advisor can ask it instead of using an API key; it runs with no tools, no saved session, in an
// empty temporary folder, and gets only the same anonymised snapshot the API would.
function isFile(p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }
function findClaudeCode() {
  if (process.env.TOWERDESK_CLAUDE_BIN !== undefined) return isFile(process.env.TOWERDESK_CLAUDE_BIN) ? process.env.TOWERDESK_CLAUDE_BIN : null;
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (dir && isFile(path.join(dir, exe))) return path.join(dir, exe);
  }
  // The desktop app's own copy: %LOCALAPPDATA%\Claude-Data\<id>\claude-code\<version>\<hash>\claude.exe
  const base = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Claude-Data');
  let best = null;
  const ls = (d) => { try { return fs.readdirSync(d); } catch (e) { return []; } };
  if (base) {
    for (const id of ls(base)) for (const ver of ls(path.join(base, id, 'claude-code'))) for (const hash of ls(path.join(base, id, 'claude-code', ver))) {
      const p = path.join(base, id, 'claude-code', ver, hash, exe);
      if (isFile(p)) { const m = fs.statSync(p).mtimeMs; if (!best || m > best.m) best = { p, m }; }
    }
  }
  return best ? best.p : null;
}
// A .js path is run with this Node (lets the tests use a fake program).
function launch(bin, args) { return /\.js$/i.test(bin) ? [process.execPath, [bin].concat(args)] : [bin, args]; }
function runClaude(bin, args, input, timeoutMs, cwd) {
  return new Promise((resolve) => {
    const env = Object.assign({}, process.env);
    delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN; // use the signed-in account, not a stray key
    const [cmd, argv] = launch(bin, args);
    let child, out = '', err = '', done = false, timer;
    const finish = (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, out, err }); };
    try { child = spawn(cmd, argv, { cwd, env, windowsHide: true }); } catch (e) { return resolve({ code: -1, out: '', err: String(e.message) }); }
    timer = setTimeout(() => { try { child.kill(); } catch (e) { /* gone */ } finish(-2); }, timeoutMs);
    child.stdout.on('data', (d) => { if (out.length < 2000000) out += d; });
    child.stderr.on('data', (d) => { if (err.length < 20000) err += d; });
    child.on('error', (e) => { err += String(e.message); finish(-1); });
    child.on('close', (code) => finish(code));
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
  });
}
function loginCommand(bin) { return '& "' + bin + '" auth login'; }

let ccStatusCache = null;
// { found, loggedIn, command } — a quick local check, cached for half a minute.
async function claudeCodeStatus() {
  const bin = findClaudeCode();
  if (!bin) return { found: false, loggedIn: false, command: '' };
  if (ccStatusCache && ccStatusCache.bin === bin && Date.now() - ccStatusCache.at < 30000) return ccStatusCache.value;
  const r = await runClaude(bin, ['auth', 'status'], '', 15000, os.tmpdir());
  let loggedIn = null;
  try { loggedIn = !!JSON.parse(r.out).loggedIn; } catch (e) { loggedIn = null; }
  const value = { found: true, loggedIn, command: loginCommand(bin) };
  ccStatusCache = { bin, at: Date.now(), value };
  return value;
}

function adviceFromCli(j) {
  if (j && j.structured_output && typeof j.structured_output === 'object') return j.structured_output;
  let t = String((j && j.result) || '').trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/.exec(t);
  if (fence) t = fence[1].trim();
  const i = t.indexOf('{'), k = t.lastIndexOf('}');
  if (i >= 0 && k > i) { try { return JSON.parse(t.slice(i, k + 1)); } catch (e) { /* fall through */ } }
  return null;
}

async function askClaudeCode(bin, ctx, findings, lang) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-cc-'));
  const timeout = Number(process.env.TOWERDESK_CLAUDE_TIMEOUT_MS) || 150000;
  const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(TOOL.input_schema), '--tools', '', '--no-session-persistence', '--disable-slash-commands', '--setting-sources', 'project,local', '--system-prompt', systemPrompt(lang, true)];
  if (process.env.TOWERDESK_CLAUDE_MODEL) args.push('--model', process.env.TOWERDESK_CLAUDE_MODEL);
  let r;
  try {
    r = await runClaude(bin, args, JSON.stringify({ snapshot: ctx, builtInFindings: findings.map((f) => f.text) }), timeout, dir);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp folder */ }
  }
  if (r.code === -2) throw new Error('Claude Code did not answer in time. Try again.');
  let j = null;
  try { j = JSON.parse(r.out); } catch (e) { j = null; }
  if (j && j.is_error) {
    const msg = String(j.result || '');
    if (/not logged in|\/login|log in/i.test(msg)) throw new Error('Claude Code on this PC is not signed in. Open PowerShell, run the command below once, sign in with your Claude account in the browser, then try again:  ' + loginCommand(bin));
    throw new Error('Claude Code could not answer: ' + msg.slice(0, 160));
  }
  if (!j) throw new Error('Claude Code could not be run' + (r.err ? ': ' + r.err.split('\n')[0].slice(0, 120) : '.'));
  const a = adviceFromCli(j);
  if (!a || typeof a !== 'object') throw new Error('Claude Code answered in an unexpected form. Try again.');
  return normalizeAdvice(a);
}

// The AI behind "Ask AI": the saved API key if there is one, otherwise Claude Code on this PC.
async function askAi(ctx, findings, lang) {
  if (savedKey()) return { via: 'api', advice: await askClaude(ctx, findings, lang) };
  const bin = findClaudeCode();
  if (bin) return { via: 'claude-code', advice: await askClaudeCode(bin, ctx, findings, lang) };
  throw new Error('No AI key saved. Add one in Settings, or sign in to Claude Code on this PC.');
}

// ---- proposals: what the owner was shown is the only thing that can be applied ----
const proposals = new Map(); // id -> { deviceId, changes, at }
function remember(deviceId, changes) {
  const now = Date.now();
  for (const [k, v] of proposals) if (now - v.at > PROPOSAL_TTL_MS) proposals.delete(k);
  const id = crypto.randomBytes(9).toString('hex');
  proposals.set(id, { deviceId, changes, at: now });
  return id;
}
function proposal(id, deviceId) {
  const p = proposals.get(String(id || ''));
  if (!p || p.deviceId !== deviceId || Date.now() - p.at > PROPOSAL_TTL_MS) return null;
  return p;
}
function forget(id) { proposals.delete(String(id || '')); }

// One run for one sector. `useAi` false gives the built-in diagnosis only.
async function advise(device, allDevices, { canApply = [], useAi = false, lang = 'en' } = {}) {
  const ctx = context(device, allDevices, canApply);
  const findings = diagnose(ctx);
  const out = { findings, ai: null, aiError: null, changes: [], proposalId: null, sent: { clients: ctx.clients.length, otherRadios: ctx.neighbours.length } };
  if (useAi) {
    try {
      const r = await askAi(ctx, findings, lang);
      const a = r.advice;
      out.via = r.via;
      out.ai = { summary: a.summary, causes: a.causes, manual: a.manual, confidence: a.confidence };
      out.changes = sanitize(ctx, a.changes);
    } catch (e) { out.aiError = e.message; }
  }
  if (out.changes.length) out.proposalId = remember(device.id, out.changes);
  return out;
}

module.exports = { channelPlan, channelChange, getConfig, status, setConfig, advise, findClaudeCode, _resetStatusCache: () => { ccStatusCache = null; }, context, diagnose, sanitize, proposal, forget, remember, MODEL, _setClientFactory };
