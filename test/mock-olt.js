// The pretend OLT must be readable by TowerDesk's own OLT reader, exactly like a real C-Data / HSGQ style EPON OLT.
const assert = require('assert');
const mock = require('../scripts/mock-olt');
const olt = require('../src/transports/olt');
const snmpT = require('../src/transports/snmp');

let fails = 0;
async function check(name, fn) { try { await fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

(async () => {
  const port = 21161;
  const s = mock.start({ port, bind: '127.0.0.1', community: 'public', onus: 6 });
  const conn = { host: '127.0.0.1', port, community: 'public', version: '2c', timeout: 3000 };
  try {
    let res;
    await check('TowerDesk\'s OLT reader recognises it as an EPON OLT and lists every ONU', async () => {
      res = await olt.readOnus(conn);
      assert.ok(res, 'no OLT found'); assert.strictEqual(res.profile, 'nscrtv'); assert.strictEqual(res.onus.length, 6);
    });
    await check('names, MAC addresses, distance and optical power are read', async () => {
      const a = res.onus.find((o) => o.name === 'Home-Ahmed');
      assert.ok(a); assert.ok(/^00:1E:A6:/.test(a.mac)); assert.strictEqual(a.distance, 600); assert.ok(a.signal < -17 && a.signal > -22, 'rx ' + a.signal); assert.strictEqual(a.txPower, 2.3); assert.ok(a.temp > 40 && a.temp < 46);
    });
    await check('one ONU has weak light on purpose', () => assert.ok(res.onus.some((o) => o.online && o.signal < -26)));
    await check('the interfaces are readable for the traffic graphs', async () => {
      const ifs = await snmpT.readInterfaces(conn);
      assert.deepStrictEqual(ifs.map((i) => i.name), ['EPON0/1', 'EPON0/2', 'GE0/1']); assert.ok(ifs.every((i) => i.up));
    });
    await check('a wrong community gets no answer', async () => {
      let failed = false; try { const r = await olt.readOnus(Object.assign({}, conn, { community: 'nope', timeout: 800 })); failed = !r; } catch (e) { failed = true; }
      assert.ok(failed);
    });
  } finally { s.stop(); }

  await check('the fourth ONU drops off for a minute in every five, the others never do', () => {
    const o = mock.makeOnus(6);
    const at = (sec, i) => mock.reading(o[i], sec * 1000).online;
    assert.strictEqual(at(10, 3), true); assert.strictEqual(at(150, 3), false); assert.strictEqual(at(200, 3), true); assert.ok([0, 1, 2, 4, 5].every((i) => at(150, i)));
  });

  if (fails) { console.log('\n' + fails + ' mock OLT test(s) failed'); process.exit(1); }
  console.log('Mock OLT tests passed.');
})();
