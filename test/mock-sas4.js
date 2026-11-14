// The pretend SAS 4 server must be readable by TowerDesk's own SAS 4 code, the way the real one is.
const assert = require('assert');
const sas4 = require('../src/transports/sas4');
const { createServer } = require('../scripts/mock-sas4');

let fails = 0;
async function check(name, fn) { try { await fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

(async () => {
  const macs = ['AA:BB:CC:00:00:01', 'AA:BB:CC:00:00:02'];
  const server = createServer({ count: 40, user: 'mgr', pass: 'p-1234', macs });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const host = '127.0.0.1:' + server.address().port;

  await check('the right login opens a session', async () => { const s = await sas4.Sas4Session.login({ host: 'http://' + host, username: 'mgr', password: 'p-1234' }); assert.ok(s.token); });
  await check('a wrong password is refused the way the real panel refuses it', async () => { await assert.rejects(() => sas4.Sas4Session.login({ host: 'http://' + host, username: 'mgr', password: 'nope' }), /rejected the login/); });
  const s = await sas4.Sas4Session.login({ host: 'http://' + host, username: 'mgr', password: 'p-1234' });
  await check('the online list is read and mapped by TowerDesk', async () => {
    const rows = (await s.online()).map(sas4.mapSession);
    assert.ok(rows.length >= 28 && rows.length <= 36, 'about four in five of 40 are online, got ' + rows.length);
    assert.ok(rows[0].username.endsWith('@lab')); assert.ok(rows[0].framedIp && rows[0].plan && rows[0].bytesDown > 0);
  });
  await check('a MAC given to the server is the one a subscriber has (so a customer radio can be matched)', async () => {
    const rows = (await s.online()).map(sas4.mapSession); assert.ok(rows.some((r) => r.mac === macs[0]));
  });
  await check('the account list carries names, phone numbers and renewal dates', async () => {
    const u = (await s.users()).map(sas4.mapUser); assert.strictEqual(u.length, 40);
    assert.ok(u.every((x) => x.name && x.phone && /^\d{4}-\d{2}-\d{2}$/.test(x.expiration) && x.plan));
    assert.ok(u.some((x) => x.online) && u.some((x) => !x.online));
  });
  await check('the data spreads renewals over past and future days', async () => {
    const u = (await s.users()).map(sas4.mapUser); const today = new Date().toISOString().slice(0, 10);
    assert.ok(u.some((x) => x.expiration < today)); assert.ok(u.some((x) => x.expiration > today));
  });
  await check('a request without the token is refused', async () => {
    const bad = new sas4.Sas4Session(s.base, 'wrong'); await assert.rejects(() => bad.online(), /expired|401/i);
  });
  await check('anything else is a 404, not a crash', async () => { const r = await fetch('http://' + host + '/nothing'); assert.strictEqual(r.status, 404); });

  server.close();
  if (fails) { console.log('\n' + fails + ' mock SAS test(s) failed'); process.exit(1); }
  console.log('Mock SAS tests passed.');
})();
