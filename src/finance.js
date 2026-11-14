// Finance settings and a daily history (data/finance.json): the monthly price of each plan, the monthly
// costs, and one snapshot per day so the trend can be drawn. Nothing here talks to a device or to SAS.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'finance.json');
const KEEP_DAYS = 400;

function load() { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function save(v) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2));
  fs.renameSync(tmp, FILE);
}

function config() {
  const v = load();
  return { currency: v.currency || 'IQD', prices: v.prices && typeof v.prices === 'object' ? v.prices : {}, expenses: Array.isArray(v.expenses) ? v.expenses : [] };
}

// { currency, prices: { plan: number }, expenses: [{ label, monthly }] }; unknown or invalid entries are dropped.
function setConfig(patch) {
  patch = patch || {};
  const v = load();
  if (patch.currency !== undefined) {
    const c = String(patch.currency).trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(c)) return { error: 'The currency is 2 to 5 letters, for example IQD or USD.' };
    v.currency = c;
  }
  if (patch.prices && typeof patch.prices === 'object') {
    const prices = {};
    Object.keys(patch.prices).slice(0, 200).forEach((k) => {
      const n = Number(patch.prices[k]);
      if (String(k).trim() && n > 0 && n < 1e12) prices[String(k).trim().slice(0, 80)] = n;
    });
    v.prices = prices;
  }
  if (Array.isArray(patch.expenses)) {
    v.expenses = patch.expenses.slice(0, 50).map((e) => ({ label: String((e && e.label) || '').trim().slice(0, 60), monthly: Number(e && e.monthly) }))
      .filter((e) => e.label && e.monthly > 0 && e.monthly < 1e12);
  }
  save(v);
  return { ok: true };
}

function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function snapshots() { const v = load(); return Array.isArray(v.history) ? v.history : []; }

// One snapshot per calendar day (the first one wins); returns true when it stored one.
function record(s, now) {
  now = now || Date.now();
  const v = load();
  const hist = Array.isArray(v.history) ? v.history : [];
  const key = dayKey(now);
  if (hist.length && hist[hist.length - 1].date === key) return false;
  hist.push({ date: key, revenue: Math.round(Number(s.revenue) || 0), expenses: Math.round(Number(s.expenses) || 0), active: Number(s.active) || 0 });
  v.history = hist.slice(-KEEP_DAYS);
  save(v);
  return true;
}

module.exports = { config, setConfig, snapshots, record };
