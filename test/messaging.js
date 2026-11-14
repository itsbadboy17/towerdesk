// Messages: team texts, customer notices, WhatsApp links, Telegram settings, and maintenance windows.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-messaging-' + process.pid);
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../public/messages-model.js');
const I = require('../public/impact-model.js');
const notify = require('../src/notify');
const maintenance = require('../src/maintenance');

let fails = 0;
let pending = 0;
function check(name, fn) { try { fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }
async function acheck(name, fn) { try { await fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

const devices = [
  { id: 'gw', name: 'Gateway', ip: '10.0.0.1', online: true, parentId: 'internet', location: 'Cabinet', role: 'device' },
  { id: 'sw', name: 'Switch', ip: '10.0.0.2', online: false, parentId: 'gw', location: 'Tower A', role: 'device' },
  { id: 's1', name: 'Sector 1', ip: '10.0.0.3', online: true, parentId: 'sw', location: 'Tower A', role: 'sector', metrics: { stationCount: 20 } }
];
const alert = { deviceName: 'Switch', ip: '10.0.0.2', openedAt: new Date(Date.now() - 12 * 60000).toISOString(), message: 'Switch latency is high (300 ms average)' };

check('an outage text names the device, what depends on it, and where', () => {
  const t = M.outageMessage(alert, I.impact(devices, 'sw'));
  assert.ok(t.includes('Switch is not responding (10.0.0.2)')); assert.ok(t.includes('1 device behind it and about 20 customers')); assert.ok(t.includes('Tower A'));
});
check('an outage text with nothing depending on it has no impact line', () => assert.ok(!M.outageMessage(alert, I.impact(devices, 's1').deviceCount ? null : { deviceCount: 0, customers: 0, sites: [] }).includes('Affects')));
check('a recovery text says how long it was down', () => assert.ok(/down for 12 min/.test(M.recoveredMessage(alert))));
check('a customer fault notice exists in Arabic and English', () => { assert.ok(/[\u0600-\u06FF]/.test(M.customerNotice('ar', 'outage'))); assert.ok(/fault/.test(M.customerNotice('en', 'outage'))); });
check('a maintenance notice carries the end time', () => assert.ok(/until \d\d:\d\d/.test(M.customerNotice('en', 'maintenance', { until: new Date().toISOString() }))));
check('the status report lists what is offline with its impact', () => {
  const t = M.statusReport({ devices }, [], Date.now());
  assert.ok(t.includes('Devices online: 2 of 3')); assert.ok(t.includes('Offline:')); assert.ok(t.includes('• Switch (1 device behind it and about 20 customers)')); assert.ok(t.includes('Customer radios: 20'));
});
check('the status report says when nothing is offline', () => assert.ok(M.statusReport({ devices: devices.map((d) => Object.assign({}, d, { online: true })) }, [], Date.now()).includes('Nothing is offline.')));
check('the status report includes what needs attention but not what is already offline', () => {
  const t = M.statusReport({ devices }, [{ id: 'sw', what: 'Switch', why: 'offline' }, { id: 's1', what: 'CPE-x', why: 'weak signal' }], Date.now());
  assert.ok(t.includes('• CPE-x: weak signal')); assert.ok(!t.includes('Switch: offline'));
});
check('Iraqi numbers get the country code', () => { assert.strictEqual(M.normalizePhone('0770 123 4567'), '9647701234567'); assert.strictEqual(M.normalizePhone('+964 770 123 4567'), '9647701234567'); assert.strictEqual(M.normalizePhone('00964770 1234567'), '9647701234567'); });
check('a number that is too short is refused', () => assert.strictEqual(M.normalizePhone('123'), ''));
check('a WhatsApp link carries the number and the text, encoded', () => { const l = M.waLink('07701234567', 'a b&c'); assert.ok(l.startsWith('https://wa.me/9647701234567?text=')); assert.ok(l.includes('a%20b%26c')); });
check('no number means no link', () => assert.strictEqual(M.waLink('', 'x'), ''));

check('Telegram starts switched off, with no token', () => { const c = notify.publicConfig(); assert.strictEqual(c.telegram.enabled, false); assert.strictEqual(c.telegram.hasToken, false); });
check('a badly formed token is refused', () => assert.ok(notify.setConfig({ token: 'nope' }).error));
check('it cannot be switched on before a token and chat are saved', () => assert.ok(notify.setConfig({ enabled: true }).error));
check('a bad chat id is refused', () => assert.ok(notify.setConfig({ chatId: 'hello there' }).error));
check('a token is saved encrypted and never shown', () => {
  const token = '123456789:AAFakeTokenForTestsOnly_abcdefghijk';
  assert.ok(notify.setConfig({ token, chatId: '-1001234567890' }).ok);
  const file = fs.readFileSync(path.join(process.env.TOWERDESK_DATA_DIR, 'notify.json'), 'utf8');
  assert.ok(!file.includes('AAFakeToken'), 'the token is in the file in clear text');
  assert.ok(!JSON.stringify(notify.publicConfig()).includes('AAFakeToken'), 'the token came back to the browser');
  assert.strictEqual(notify.publicConfig().telegram.hasToken, true);
});
check('with a token and chat it can be switched on and off', () => { assert.ok(notify.setConfig({ enabled: true }).ok); assert.strictEqual(notify.publicConfig().telegram.enabled, true); assert.ok(notify.setConfig({ enabled: false }).ok); });
check('removing the token switches it off', () => { notify.setConfig({ enabled: true }); notify.setConfig({ clearToken: true }); const c = notify.publicConfig(); assert.strictEqual(c.telegram.hasToken, false); assert.strictEqual(c.telegram.enabled, false); });
check('the WhatsApp country code can be changed, digits only', () => { assert.ok(notify.setConfig({ countryCode: '962' }).ok); assert.strictEqual(notify.config().whatsapp.countryCode, '962'); assert.ok(notify.setConfig({ countryCode: 'abc' }).error); });

check('a maintenance window mutes its device until it ends', () => {
  const r = maintenance.add({ scope: 'device', id: 'sw', hours: 2, reason: 'cable work' }, 1000000);
  assert.ok(r.ok);
  assert.ok(maintenance.isMuted({ id: 'sw', location: 'x' }, 1000000 + 3600000));
  assert.ok(!maintenance.isMuted({ id: 'sw', location: 'x' }, 1000000 + 3 * 3600000));
  assert.ok(!maintenance.isMuted({ id: 'other', location: 'x' }, 1000000 + 1000));
});
check('a site window mutes every device on the site (any capitalisation)', () => {
  maintenance.add({ scope: 'site', site: 'Tower A', hours: 1 }, Date.now());
  assert.ok(maintenance.isMuted({ id: 'zz', location: ' tower a ' }));
  assert.ok(!maintenance.isMuted({ id: 'zz', location: 'Tower B' }));
});
check('a window can be ended early', () => { const w = maintenance.active().find((x) => x.scope === 'site'); assert.ok(maintenance.remove(w.id)); assert.ok(!maintenance.isMuted({ id: 'zz', location: 'Tower A' })); });
check('a window needs a length, a target, and has a ceiling', () => {
  assert.ok(maintenance.add({ scope: 'device', id: 'x', hours: 0 }).error);
  assert.ok(maintenance.add({ scope: 'device', hours: 1 }).error);
  assert.ok(maintenance.add({ scope: 'site', site: ' ', hours: 1 }).error);
  const long = maintenance.add({ scope: 'device', id: 'long', hours: 9999 }, 0);
  assert.strictEqual(Date.parse(long.window.until) - Date.parse(long.window.at), maintenance.MAX_HOURS * 3600000);
});
check('a muted device raises no alert', () => {
  const alerts = require('../src/alerts');
  maintenance.add({ scope: 'device', id: 'muted1', hours: 1 });
  alerts.evaluate({ id: 'muted1', name: 'Muted', ip: '10.9.9.9' }, { online: false, downStreak: 99 });
  assert.ok(!alerts.list().some((a) => a.deviceId === 'muted1'));
  alerts.evaluate({ id: 'loud1', name: 'Loud', ip: '10.9.9.8' }, { online: false, downStreak: 99 });
  assert.ok(alerts.list().some((a) => a.deviceId === 'loud1'));
});

(async () => {
  await acheck('sending without a bot set up is refused without touching the network', async () => { const r = await notify.telegramSend('hi'); assert.strictEqual(r.ok, false); assert.ok(/not set up/.test(r.error)); });
  if (fails) { console.log('\n' + fails + ' messaging test(s) failed'); process.exit(1); }
  console.log('Messaging tests passed.');
})();
