// Outage impact: what is behind a device, and how many customers.
const assert = require('assert');
const M = require('../public/impact-model.js');

let fails = 0;
function check(name, fn) { try { fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }

const devs = [
  { id: 'gw', name: 'Gateway', parentId: 'internet', location: 'Cabinet', metrics: null },
  { id: 'sw', name: 'Switch', parentId: 'gw', location: 'Tower A', metrics: null },
  { id: 's1', name: 'Sector 1', role: 'sector', parentId: 'sw', location: 'Tower A', metrics: { stationCount: 12 } },
  { id: 's2', name: 'Sector 2', role: 'sector', parentId: 'sw', location: 'Tower A', metrics: { stationCount: null, stationCountLast: 30 } },
  { id: 'olt', name: 'OLT', parentId: 'gw', location: 'Cabinet', metrics: { onuCount: 40 } },
  { id: 'lone', name: 'Lone sector', role: 'sector', metrics: { stationCount: 5 } }
];

check('a sector with nothing below it affects only its own customers', () => { const i = M.impact(devs, 's1'); assert.strictEqual(i.deviceCount, 0); assert.strictEqual(i.customers, 12); });
check('a switch affects every device below it and their customers', () => { const i = M.impact(devs, 'sw'); assert.strictEqual(i.deviceCount, 2); assert.strictEqual(i.customers, 42); assert.strictEqual(i.sectors, 2); });
check('the gateway affects the whole tree under it', () => { const i = M.impact(devs, 'gw'); assert.strictEqual(i.deviceCount, 4); assert.strictEqual(i.customers, 82); });
check('an offline sector still counts the customers it had', () => assert.strictEqual(M.customersOf(devs[3]), 30));
check('ONUs count as customers on an OLT', () => assert.strictEqual(M.customersOf(devs[4]), 40));
check('sites below are listed once', () => assert.deepStrictEqual(M.impact(devs, 'gw').sites.sort(), ['Cabinet', 'Tower A']));
check('a device that is not connected to anything has no devices below', () => assert.strictEqual(M.impact(devs, 'lone').deviceCount, 0));
check('the tree is known once anything has a parent', () => { assert.ok(M.impact(devs, 's1').treeKnown); assert.ok(!M.impact([{ id: 'a', name: 'A' }], 'a').treeKnown); });
check('a loop in the parents does not hang', () => { const loop = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }]; assert.strictEqual(M.impact(loop, 'a').deviceCount, 1); });
check('an unknown device gives an empty answer', () => assert.strictEqual(M.impact(devs, 'nope').customers, 0));
check('the sentence says devices and customers', () => assert.strictEqual(M.sentence(M.impact(devs, 'sw')), '2 devices behind it and about 42 customers'));
check('the sentence is singular for one', () => assert.strictEqual(M.sentence({ deviceCount: 1, customers: 1 }), '1 device behind it and about 1 customer'));
check('the sentence is empty when nothing depends on it', () => assert.strictEqual(M.sentence({ deviceCount: 0, customers: 0 }), ''));

if (fails) { console.log('\n' + fails + ' impact test(s) failed'); process.exit(1); }
console.log('Impact tests passed.');
