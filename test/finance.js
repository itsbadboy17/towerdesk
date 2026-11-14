// Finance estimates: revenue from plan prices x active subscribers, renewals due, expenses and profit.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-finance-' + process.pid);
const assert = require('assert');
const F = require('../public/finance-model.js');
const store = require('../src/finance');

let fails = 0;
function check(name, fn) { try { fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

const now = new Date(2026, 10, 14, 15, 0, 0).getTime(); // 14 Nov 2026, afternoon
const d = (offset) => { const x = new Date(2026, 10, 14 + offset); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const subs = [
  { plan: 'Home 10M', enabled: true, expiration: d(20), name: 'A', username: 'a', phone: '0770111' },
  { plan: 'Home 10M', enabled: true, expiration: d(3), name: 'B', username: 'b', phone: '0770222' },
  { plan: 'Pro 50M', enabled: true, expiration: d(0), name: 'C', username: 'c' },
  { plan: 'Pro 50M', enabled: true, expiration: d(-5), name: 'D', username: 'd' },
  { plan: 'Pro 50M', enabled: false, expiration: d(10), name: 'E', username: 'e' },
  { plan: 'Mystery', enabled: true, expiration: null, name: 'F', username: 'f' }
];
const cfg = { prices: { 'Home 10M': 15000, 'Pro 50M': 40000 }, expenses: [{ label: 'Bandwidth', monthly: 30000 }, { label: 'Power', monthly: 5000 }, { label: 'bad', monthly: -9 }] };
const S = F.compute(subs, cfg, now);

check('active subscribers are counted, expired and switched-off ones are not', () => { assert.strictEqual(S.active, 4); assert.strictEqual(S.expired, 1); assert.strictEqual(S.disabled, 1); });
check('revenue is price times active subscribers', () => assert.strictEqual(S.revenue, 15000 + 15000 + 40000 + 0));
check('expenses add up and a negative one is ignored', () => assert.strictEqual(S.expenses, 35000));
check('profit is revenue minus expenses', () => assert.strictEqual(S.profit, 70000 - 35000));
check('a plan with no price is flagged so the owner can set it', () => assert.deepStrictEqual(S.unpriced, ['Mystery']));
check('renewals due this week are listed soonest first, with the day count', () => { assert.deepStrictEqual(S.expiring.map((x) => x.username), ['c', 'b']); assert.deepStrictEqual(S.expiring.map((x) => x.days), [0, 3]); });
check('revenue at stake in 7 and 30 days', () => { assert.strictEqual(S.expiring7, 2); assert.strictEqual(S.revenueAt7, 40000 + 15000); assert.strictEqual(S.expiring30, 3); assert.strictEqual(S.revenueAt30, 70000); });
check('renewals are binned by week', () => { assert.strictEqual(S.weeks[0].count, 2); assert.strictEqual(S.weeks[2].count, 1); assert.strictEqual(S.weeks[1].count, 0); });
check('recently lapsed subscribers are listed with how long ago', () => { assert.strictEqual(S.lapsed.length, 1); assert.strictEqual(S.lapsed[0].days, -5); assert.strictEqual(S.lapsedRevenue, 40000); });
check('plans are sorted by the revenue they bring', () => assert.strictEqual(S.plans[0].plan, 'Pro 50M'));
check('no prices at all gives zero revenue, not NaN', () => { const Z = F.compute(subs, { prices: {}, expenses: [] }, now); assert.strictEqual(Z.revenue, 0); assert.strictEqual(Z.profit, 0); });
check('an empty list is fine', () => { const Z = F.compute([], null, now); assert.strictEqual(Z.active, 0); assert.strictEqual(Z.weeks.length, 5); });
check('an ISO date with a time is read as that day', () => assert.strictEqual(F.parseDate('2026-11-20T08:00:00Z') !== null, true));
check('a renewal notice exists in Arabic and English and says when', () => {
  assert.ok(/[؀-ۿ]/.test(F.renewalNotice('ar', 3, '17 Nov')));
  assert.ok(/ends in 3 days/.test(F.renewalNotice('en', 3, '17 Nov')));
  assert.ok(/ends today/.test(F.renewalNotice('en', 0)));
  assert.ok(/has ended/.test(F.renewalNotice('en', -2)));
});
check('money is shown with thousands separators', () => assert.strictEqual(F.money(1250000, 'IQD'), '1,250,000 IQD'));

check('settings start empty', () => { const c = store.config(); assert.deepStrictEqual(c.prices, {}); assert.strictEqual(c.currency, 'IQD'); });
check('prices and expenses are saved and cleaned', () => {
  const r = store.setConfig({ currency: 'iqd', prices: { 'Home 10M': '15000', 'Bad': -4, '': 5, 'Text': 'abc' }, expenses: [{ label: 'Power', monthly: '5000' }, { label: '', monthly: 10 }, { label: 'X', monthly: 'no' }] });
  assert.ok(r.ok);
  const c = store.config();
  assert.deepStrictEqual(c.prices, { 'Home 10M': 15000 }); assert.strictEqual(c.currency, 'IQD'); assert.deepStrictEqual(c.expenses.map((e) => e.label), ['Power']);
});
check('a currency must be letters', () => assert.ok(store.setConfig({ currency: '12$' }).error));
check('one snapshot per day, newest kept', () => {
  assert.ok(store.record({ revenue: 100, expenses: 10, active: 5 }, now));
  assert.ok(!store.record({ revenue: 120, expenses: 10, active: 6 }, now + 3600000));
  assert.ok(store.record({ revenue: 130, expenses: 10, active: 7 }, now + 86400000));
  const s = store.snapshots();
  assert.strictEqual(s.length, 2); assert.strictEqual(s[0].revenue, 100); assert.strictEqual(s[1].revenue, 130);
});

if (fails) { console.log('\n' + fails + ' finance test(s) failed'); process.exit(1); }
console.log('Finance tests passed.');
