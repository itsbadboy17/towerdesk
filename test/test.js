const assert = require('node:assert');

// Test 1: Verify mock-data
const mockData = require('../public/mock-data');
assert.ok(Array.isArray(mockData.towers) && mockData.towers.length > 0);
assert.ok(Array.isArray(mockData.subscribers) && mockData.subscribers.length > 0);
assert.ok(Array.isArray(mockData.plans) && mockData.plans.length > 0);
assert.ok(Array.isArray(mockData.vouchers) && mockData.vouchers.length > 0);

// Test 2: Verify mock-connector object
const { mockConnectors } = require('../public/mock-connector');
assert.ok(typeof mockConnectors === 'object');
assert.ok(mockConnectors.hasOwnProperty('mikrotik'), 'Missing mikrotik connector');
assert.ok(mockConnectors.hasOwnProperty('cisco'), 'Missing cisco connector');
assert.ok(mockConnectors.hasOwnProperty('ubnt'), 'Missing ubnt connector');
assert.ok(mockConnectors.hasOwnProperty('mimosa'), 'Missing mimosa connector');
assert.ok(mockConnectors.hasOwnProperty('tplink'), 'Missing tplink connector');
assert.ok(mockConnectors.hasOwnProperty('onu'), 'Missing onu connector');

const connectorKeys = ['mikrotik', 'cisco', 'ubnt', 'mimosa', 'tplink', 'onu'];
for (const key of connectorKeys) {
  const connector = mockConnectors[key];
  assert.strictEqual(typeof connector.connect, 'function', `connect is not a function for ${key}`);
  assert.strictEqual(typeof connector.getStatus, 'function', `getStatus is not a function for ${key}`);
  assert.strictEqual(typeof connector.getInterfaces, 'function', `getInterfaces is not a function for ${key}`);
}

// Test 3: Validate server.js syntax
const { execSync } = require('node:child_process');
assert.doesNotThrow(() => execSync('node --check server.js', { cwd: process.cwd() }));

console.log('All tests passed successfully!');
