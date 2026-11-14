// Messages out of TowerDesk. Telegram: an optional bot (token + chat id, stored encrypted) that posts new
// outages and recoveries. WhatsApp: there is no automatic sending (an unofficial sender can get a number
// banned), so TowerDesk writes the text and opens the owner's own WhatsApp with it filled in.
// Nothing leaves the computer unless a bot is configured and switched on. The token is never logged,
// returned to the browser, or placed in an error message.
const fs = require('fs');
const path = require('path');
const https = require('https');
const { dataDir } = require('./paths');
const storage = require('./storage');
const impactModel = require('../public/impact-model.js');
const msg = require('../public/messages-model.js');

const FILE = path.join(dataDir(), 'notify.json');
const PER_DEVICE_MS = 10 * 60 * 1000;   // the same kind of message about one device at most every 10 minutes
const PER_HOUR = 30;                      // and never more than this many an hour overall

function load() { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function save(c) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
function config() {
  const c = load();
  const t = c.telegram || {};
  return {
    telegram: { enabled: !!t.enabled, tokenEnc: t.tokenEnc || '', chatId: t.chatId || '', events: Object.assign({ down: true, recovered: true, latency: false }, t.events || {}) },
    whatsapp: { countryCode: String((c.whatsapp && c.whatsapp.countryCode) || '964').replace(/\D/g, '').slice(0, 4) || '964' }
  };
}

// What the browser may see: never the token itself.
function publicConfig() {
  const c = config();
  return { telegram: { enabled: c.telegram.enabled, hasToken: !!c.telegram.tokenEnc, chatId: c.telegram.chatId, events: c.telegram.events }, whatsapp: c.whatsapp, last: lastResult };
}

function setConfig(patch) {
  patch = patch || {};
  const c = load();
  c.telegram = c.telegram || {};
  if (patch.clearToken) { c.telegram.tokenEnc = ''; c.telegram.enabled = false; }
  if (typeof patch.token === 'string' && patch.token.trim()) {
    const tok = patch.token.trim();
    if (!/^\d{5,12}:[A-Za-z0-9_-]{20,60}$/.test(tok)) return { error: 'That does not look like a Telegram bot token (it looks like 123456789:AA…).' };
    c.telegram.tokenEnc = storage.encrypt(tok);
  }
  if (patch.chatId !== undefined) {
    const id = String(patch.chatId).trim();
    if (id && !/^(-?\d{3,20}|@[A-Za-z0-9_]{4,40})$/.test(id)) return { error: 'The chat id is a number (it may start with -) or @channelname.' };
    c.telegram.chatId = id;
  }
  if (patch.events && typeof patch.events === 'object') {
    c.telegram.events = Object.assign({ down: true, recovered: true, latency: false }, c.telegram.events || {}, ['down', 'recovered', 'latency'].reduce((o, k) => { if (patch.events[k] !== undefined) o[k] = !!patch.events[k]; return o; }, {}));
  }
  if (patch.enabled !== undefined) {
    if (patch.enabled && !(c.telegram.tokenEnc && c.telegram.chatId)) return { error: 'Save the bot token and the chat id first.' };
    c.telegram.enabled = !!patch.enabled;
  }
  if (patch.countryCode !== undefined) {
    const cc = String(patch.countryCode).replace(/\D/g, '');
    if (!/^\d{1,4}$/.test(cc)) return { error: 'The country code is digits only, for example 964.' };
    c.whatsapp = Object.assign({}, c.whatsapp, { countryCode: cc });
  }
  save(c);
  return { ok: true };
}

// ---------------- sending ----------------
let lastResult = null; // { at, ok, text } for the Settings page (no secrets)

function telegramRequest(token, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({ host: 'api.telegram.org', path: '/bot' + token + '/sendMessage', method: 'POST', timeout: 8000, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let buf = '';
      res.on('data', (d) => { buf += d; if (buf.length > 20000) res.destroy(); });
      res.on('end', () => {
        if (res.statusCode === 200) return resolve({ ok: true });
        if (res.statusCode === 401 || res.statusCode === 404) return resolve({ ok: false, error: 'Telegram did not accept the bot token.' });
        if (res.statusCode === 400 || res.statusCode === 403) return resolve({ ok: false, error: 'Telegram cannot reach that chat. Open the bot in Telegram, press Start, and check the chat id.' });
        if (res.statusCode === 429) return resolve({ ok: false, error: 'Telegram says too many messages. It will work again soon.' });
        resolve({ ok: false, error: 'Telegram answered with an error (' + res.statusCode + ').' });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'No answer from Telegram. Is this computer online?' }); });
    req.on('error', () => resolve({ ok: false, error: 'Could not reach Telegram. Is this computer online?' }));
    req.end(data);
  });
}

async function telegramSend(text) {
  const c = config().telegram;
  if (!c.tokenEnc || !c.chatId) return { ok: false, error: 'Telegram is not set up yet.' };
  let token;
  try { token = storage.decrypt(c.tokenEnc); } catch (e) { return { ok: false, error: 'The saved token cannot be read. Save it again.' }; }
  const r = await telegramRequest(token, { chat_id: c.chatId, text: String(text).slice(0, 3800), disable_web_page_preview: true });
  lastResult = { at: new Date().toISOString(), ok: r.ok, text: r.ok ? 'Last message sent.' : r.error };
  return r;
}

// ---------------- alert hooks (called by src/alerts.js; never throw) ----------------
const sentAt = new Map();   // `${deviceId}|${kind}` -> time
let hourly = [];
function allowed(key) {
  const now = Date.now();
  hourly = hourly.filter((t) => now - t < 3600 * 1000);
  if (hourly.length >= PER_HOUR) return false;
  if (now - (sentAt.get(key) || 0) < PER_DEVICE_MS) return false;
  sentAt.set(key, now); hourly.push(now);
  return true;
}
function wants(kind) { const c = config().telegram; return c.enabled && c.events[kind]; }

function alertOpened(alert) {
  try {
    const kind = alert.kind === 'offline' ? 'down' : 'latency';
    if (!wants(kind) || !allowed(alert.deviceId + '|' + kind)) return;
    let text;
    if (kind === 'down') {
      const snap = require('./monitor').snapshot();
      text = msg.outageMessage(alert, impactModel.impact(snap.devices, alert.deviceId));
    } else text = msg.latencyMessage(alert);
    telegramSend(text).catch(() => {});
  } catch (e) { /* a message problem must never disturb monitoring */ }
}
function alertResolved(alert) {
  try {
    if (alert.kind !== 'offline' || !wants('recovered') || !allowed(alert.deviceId + '|recovered')) return;
    telegramSend(msg.recoveredMessage(alert)).catch(() => {});
  } catch (e) { /* see above */ }
}

module.exports = { publicConfig, setConfig, telegramSend, alertOpened, alertResolved, config };
