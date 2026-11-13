// Tests the RADIUS/SAS subscribers module: demo shape, summary math, and config round-trip.
// Uses a temporary data dir so it never touches a real install's saved settings.
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-subs-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const subs = require('../src/subscribers');

function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); process.exit(1); }
  console.log('pass  ' + name);
}

(async function () {
  // Demo source returns a populated, well-shaped list with a consistent summary.
  const demo = await subs.list({ demo: true });
  ok('demo source', demo.source === 'demo' && demo.configured === true);
  ok('demo has subscribers', Array.isArray(demo.subscribers) && demo.subscribers.length === 24);

  const s = demo.subscribers[0];
  ['id', 'username', 'name', 'plan', 'online', 'nas', 'sessionText', 'bytesDown', 'bytesUp'].forEach(function (k) {
    ok('field ' + k, Object.prototype.hasOwnProperty.call(s, k));
  });

  // Summary totals agree with the rows.
  const online = demo.subscribers.filter(function (x) { return x.online; }).length;
  ok('summary total', demo.summary.total === 24);
  ok('summary online', demo.summary.online === online);
  ok('summary offline', demo.summary.offline === 24 - online);
  ok('summary down bps >= 0', demo.summary.liveDownBps >= 0);

  // Offline subscribers carry no live rate and no session.
  const off = demo.subscribers.find(function (x) { return !x.online; });
  ok('offline exists (South sector)', !!off);
  ok('offline no live rate', off.liveDownBps === 0 && off.liveUpBps === 0);

  // Unconfigured install returns an empty, un-configured result (not demo).
  const none = await subs.list({});
  ok('unconfigured source none', none.source === 'none' && none.configured === false);
  ok('unconfigured empty', none.subscribers.length === 0);

  // Config round-trip: secret is stored but never returned in the public view.
  const saved = subs.setConfig({ source: 'mikrotik', host: '10.90.0.1', username: 'admin', password: 'sw0rdfish', nas: 'Core NAS' });
  ok('config saved source', saved.source === 'mikrotik');
  ok('config host', saved.host === '10.90.0.1');
  ok('config hides secret', saved.hasSecret === true && saved.secret === undefined);

  const got = subs.getConfig();
  ok('config persisted', got.host === '10.90.0.1' && got.nas === 'Core NAS');

  // After saving a non-demo source, list() tries it (mikrotik unreachable here) and degrades
  // gracefully to an empty list with a note, never throwing.
  const mt = await subs.list({});
  ok('mikrotik degrades', mt.source === 'mikrotik' && mt.subscribers.length === 0 && typeof mt.note === 'string');

  // Disconnecting: 'none' is a valid source so the operator can clear the server.
  const off2 = subs.setConfig({ source: 'none' });
  ok('can disconnect', off2.source === 'none');
  const afterOff = await subs.list({});
  ok('disconnected is empty', afterOff.source === 'none' && afterOff.configured === false);

  // ---- SAS Radius 4 source, against a fake panel that speaks the same wrapped-payload API ----
  const http = require('http');
  const sas4 = require('../src/transports/sas4');
  ok('sas4 payload round-trips', sas4.decrypt(sas4.encrypt('{"a":1}')) === '{"a":1}');
  ok('sas4 payload is salted + random', /^U2FsdGVkX1/.test(sas4.encrypt('x')) && sas4.encrypt('x') !== sas4.encrypt('x'));
  ok('sas4 address forms', sas4.baseUrls('sas.example.com').join() === 'https://sas.example.com/admin/api/index.php/api/,http://sas.example.com/admin/api/index.php/api/' &&
    sas4.baseUrls('http://10.0.0.5:8080/admin/').join() === 'http://10.0.0.5:8080/admin/api/index.php/api/');

  const SAS_PASS = 'm4nager-' + Math.random().toString(16).slice(2);
  const stats = { logins: 0, octets: 1000000 };
  const fake = http.createServer((req, res) => {
    let b = '';
    req.on('data', (d) => { b += d; });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(sas4.decrypt(JSON.parse(b).payload)); } catch (e) { res.writeHead(400); return res.end('{}'); }
      const send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url === '/admin/api/index.php/api/login') {
        if (body.username === 'manager' && body.password === SAS_PASS) { stats.logins++; return send(200, { status: 200, token: 'tok-' + stats.logins }); }
        return send(401, { status: 401, message: 'Invalid credentials' });
      }
      if (req.url === '/admin/api/index.php/api/index/online') {
        if (req.headers.authorization !== 'Bearer tok-' + stats.logins) return send(401, {});
        stats.octets += 2500000; // 2.5 MB more downloaded on every read
        const rows = body.page === 1
          ? [{ id: 11, username: 'ali@net', user_profile_name: '20M', framedipaddress: '10.8.0.11', callingstationid: 'AA:BB:CC:00:00:01', acctsessiontime: 3700, acctoutputoctets: stats.octets, acctinputoctets: 5000 }]
          : [{ id: 12, username: 'sara@net', user_profile_name: '10M', framedipaddress: '10.8.0.12', callingstationid: 'AA:BB:CC:00:00:02', acctsessiontime: 60, acctoutputoctets: 1, acctinputoctets: 1 }];
        return send(200, { current_page: body.page, last_page: 2, data: rows });
      }
      if (req.url === '/admin/api/index.php/api/index/user') {
        if (req.headers.authorization !== 'Bearer tok-' + stats.logins) return send(401, {});
        stats.userReads = (stats.userReads || 0) + 1;
        return send(200, { current_page: 1, last_page: 1, data: [
          { id: 1, username: 'ali@net', firstname: 'Ali', lastname: 'Hasan', online_status: 1, enabled: 1, expiration: '2027-01-01 00:00:00', profile_details: { name: '20M' } },
          { id: 2, username: 'sara@net', firstname: 'Sara', lastname: '', online_status: 1, enabled: 1 },
          { id: 3, username: 'omar@net', firstname: 'Omar', lastname: 'Zaid', online_status: 0, enabled: 1, expiration: '2026-12-01 00:00:00', phone: '0770', profile_details: { name: '10M' } }
        ] });
      }
      send(404, {});
    });
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const sasUrl = 'http://127.0.0.1:' + fake.address().port;

  subs.setConfig({ source: 'sas4', host: sasUrl, username: 'manager', password: 'wrong' });
  let sr = await subs.list({});
  ok('sas4 wrong password gives a note, no throw', sr.source === 'sas4' && sr.subscribers.length === 0 && /login/i.test(sr.note));

  const cfgSaved = subs.setConfig({ source: 'sas4', host: sasUrl, username: 'manager', password: SAS_PASS });
  ok('sas4 config hides password', cfgSaved.hasSecret === true && JSON.stringify(cfgSaved).indexOf(SAS_PASS) === -1);
  ok('sas4 password encrypted at rest', fs.readFileSync(path.join(tmp, 'radius.json'), 'utf8').indexOf(SAS_PASS) === -1);
  sr = await subs.list({});
  ok('sas4 lists both pages', sr.subscribers.filter((x) => x.online).length === 2 && sr.note === null && sr.summary.online === 2);
  const omar = sr.subscribers.find((x) => x.username === 'omar@net');
  ok('sas4 offline account listed', sr.subscribers.length === 3 && omar && omar.online === false && omar.name === 'Omar Zaid' && omar.plan === '10M' && omar.phone === '0770' && sr.summary.offline === 1);
  ok('sas4 online row gets the real name', sr.subscribers.find((x) => x.username === 'ali@net').name === 'Ali Hasan');
  const ali = sr.subscribers.find((x) => x.username === 'ali@net');
  ok('sas4 session fields', ali.plan === '20M' && ali.framedIp === '10.8.0.11' && ali.mac === 'AA:BB:CC:00:00:01' && ali.sessionText === '1h 1m' && ali.online === true);
  ok('sas4 first read has no live rate yet', ali.liveDownBps === null);
  await new Promise((r) => setTimeout(r, 300));
  sr = await subs.list({});
  const ali2 = sr.subscribers.find((x) => x.username === 'ali@net');
  ok('sas4 live rate from counter growth', ali2.liveDownBps > 1e6 && ali2.liveUpBps === 0);
  ok('sas4 reuses one login', stats.logins === 1);
  ok('sas4 account list is cached between polls', stats.userReads === 1);
  ok('sas4 result never contains the password', JSON.stringify(sr).indexOf(SAS_PASS) === -1);
  fake.close();
  sr = await subs.list({});
  ok('sas4 unreachable degrades to a note', sr.subscribers.length === 0 && typeof sr.note === 'string');

  subs.setConfig({ source: 'none' });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('Subscribers module tests passed.');
})();
