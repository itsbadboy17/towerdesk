// Staff accounts: roles, what each role may reach, and the rules that stop an owner locking themselves out.
process.env.TOWERDESK_DATA_DIR = require('path').join(require('os').tmpdir(), 'towerdesk-test-staff-' + process.pid);
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const auth = require('../src/auth');

let fails = 0;
function check(name, fn) { try { fn(); console.log('pass  ' + name); } catch (e) { fails++; console.log('FAIL  ' + name + '\n      ' + e.message); } }
const can = auth.canAccess;

check('no accounts means the login is off', () => assert.strictEqual(auth.isConfigured(), false));
check('the first account is always an admin', () => { const r = auth.createUser('owner', 'longpassword1', 'viewer'); assert.ok(r.ok); assert.strictEqual(r.role, 'admin'); assert.strictEqual(auth.roleOf('owner'), 'admin'); });
check('the login turns on once there is an account', () => assert.strictEqual(auth.isConfigured(), true));
check('a short password is refused', () => assert.ok(auth.createUser('tech1', 'short', 'tech').error));
check('a bad username is refused', () => assert.ok(auth.createUser('a b', 'longpassword1', 'tech').error));
check('an unknown role is refused', () => assert.ok(auth.createUser('x1', 'longpassword1', 'boss').error));
check('a technician and a viewer can be added', () => { assert.ok(auth.createUser('tech1', 'longpassword1', 'tech').ok); assert.ok(auth.createUser('view1', 'longpassword1', 'viewer').ok); });
check('a name cannot be used twice', () => assert.ok(auth.createUser('tech1', 'longpassword1', 'tech').error));
check('the list never contains a password or hash', () => { const t = JSON.stringify(auth.listUsers()); assert.ok(!/hash|salt|longpassword1/.test(t)); assert.strictEqual(auth.listUsers().length, 3); });
check('passwords are stored hashed, not as typed', () => assert.ok(!fs.readFileSync(path.join(process.env.TOWERDESK_DATA_DIR, 'auth.json'), 'utf8').includes('longpassword1')));
check('the right password signs in, a wrong one does not', () => { assert.ok(auth.verify('owner', 'longpassword1')); assert.ok(!auth.verify('owner', 'wrongpassword')); assert.ok(!auth.verify('nobody', 'longpassword1')); });

check('admin may do everything', () => { assert.ok(can('admin', 'POST', '/api/users')); assert.ok(can('admin', 'GET', '/settings')); assert.ok(can('admin', 'DELETE', '/api/devices/x')); });
check('technician may manage devices and run the advisor', () => { assert.ok(can('tech', 'POST', '/api/devices')); assert.ok(can('tech', 'POST', '/api/advisor/x/apply')); assert.ok(can('tech', 'POST', '/api/neighbors/scan')); assert.ok(can('tech', 'GET', '/api/monitor')); });
check('technician may not touch staff, settings, saved logins, backups, updates or money', () => {
  ['/api/users', '/api/users/tech1', '/api/credentials', '/api/backup', '/api/restore', '/api/update/install', '/api/ai/config', '/api/radius/config', '/api/finance', '/api/notify/config', '/settings', '/settings.html', '/finance'].forEach((p) => assert.ok(!can('tech', 'GET', p) && !can('tech', 'POST', p), p));
});
check('viewer may look but not change', () => { assert.ok(can('viewer', 'GET', '/api/monitor')); assert.ok(can('viewer', 'GET', '/topology')); assert.ok(!can('viewer', 'POST', '/api/devices')); assert.ok(!can('viewer', 'DELETE', '/api/devices/x')); assert.ok(!can('viewer', 'PUT', '/api/devices/x')); assert.ok(!can('viewer', 'POST', '/api/neighbors/scan')); });
check('viewer may still ping, trace and sign out', () => { assert.ok(can('viewer', 'POST', '/api/tools/ping')); assert.ok(can('viewer', 'POST', '/api/logout')); });
check('viewer may not open admin pages either', () => { assert.ok(!can('viewer', 'GET', '/settings')); assert.ok(!can('viewer', 'GET', '/api/users')); });
check('an unknown role may do nothing', () => assert.ok(!can('nobody', 'GET', '/api/monitor')));

check('the last admin cannot be demoted or deleted', () => { assert.ok(auth.updateUser('owner', { role: 'tech' }).error); assert.ok(auth.removeUser('owner', 'someone-else').error); });
check('you cannot delete the account you are using', () => assert.ok(auth.removeUser('tech1', 'tech1').error));
check('with a second admin, the first can be demoted', () => { assert.ok(auth.updateUser('view1', { role: 'admin' }).ok); assert.ok(auth.updateUser('owner', { role: 'tech' }).ok); assert.strictEqual(auth.roleOf('owner'), 'tech'); assert.ok(auth.updateUser('owner', { role: 'admin' }).ok); });
check('a password change needs 8 characters and keeps the role', () => { assert.ok(auth.updateUser('tech1', { password: 'abc' }).error); assert.ok(auth.updateUser('tech1', { password: 'anotherlongone' }).ok); assert.strictEqual(auth.roleOf('tech1'), 'tech'); });
check('the command line keeps an existing role when it sets a password', () => { auth.setUser('tech1', 'yetanotherpass'); assert.strictEqual(auth.roleOf('tech1'), 'tech'); });
check('an account made before roles existed is an admin', () => {
  const file = path.join(process.env.TOWERDESK_DATA_DIR, 'auth.json');
  const j = JSON.parse(fs.readFileSync(file, 'utf8')); j.users.legacy = { salt: j.users.owner.salt, hash: j.users.owner.hash }; fs.writeFileSync(file, JSON.stringify(j));
  assert.strictEqual(auth.roleOf('legacy'), 'admin');
});
check('deleting an account removes it', () => { assert.ok(auth.removeUser('view1', 'owner').ok); assert.ok(!auth.listUsers().some((u) => u.username === 'view1')); });

if (fails) { console.log('\n' + fails + ' staff test(s) failed'); process.exit(1); }
console.log('Staff tests passed.');
