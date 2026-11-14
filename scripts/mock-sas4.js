// A pretend SAS Radius 4 server for testing TowerDesk without the real (commercial) product.
// It speaks the part of the SAS 4 admin API that TowerDesk reads: login, index/online and index/user, with the
// same encrypted request body. It invents subscribers (names, plans, phone numbers, renewal dates, MAC addresses,
// usage) and changes nothing anywhere. For testing only: never point it at real customers' data.
//
//   node scripts/mock-sas4.js [--port 8085] [--count 60] [--user manager] [--pass lab-pass] [--macs file.txt]
//
// In TowerDesk: Subscribers (SAS) -> Connect server -> SAS 4, address 127.0.0.1:8085, the user and password above.
// --macs: a text file with one MAC address per line; the first subscribers use them, so a customer radio that a
// sector reports can be matched to a subscriber (that is how TowerDesk links a customer to a sector).
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const sas4 = require('../src/transports/sas4');

const PLANS = [{ name: 'Home 10M', down: 10 }, { name: 'Home 20M', down: 20 }, { name: 'Pro 50M', down: 50 }, { name: 'Business 100M', down: 100 }];
const FIRST = ['Ahmed', 'Zaid', 'Mazen', 'Bilal', 'Firas', 'Omar', 'Kareem', 'Hassan', 'Ali', 'Yousef', 'Fatima', 'Huda', 'Mariam', 'Rasha', 'Nadia', 'Lina', 'Sara', 'Aisha', 'Noor', 'Dina'];
const LAST = ['Saleh', 'Mansour', 'Hamdan', 'Daoud', 'Fadel', 'Haddad', 'Shadid', 'Nasser', 'Hilal', 'Jalal', 'Sabbagh', 'Ghanem', 'Noor', 'Khalil'];

function make(count, macs, now) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[i % FIRST.length], last = LAST[(i * 3 + 1) % LAST.length];
    const plan = PLANS[(i * 7 + 3) % PLANS.length];
    const online = i % 5 !== 4;                                        // about four in five are online
    const mac = macs[i] || ['DC', '9F', 'DB', ((i * 11 + 16) % 256).toString(16).padStart(2, '0'), ((i * 7 + 32) % 256).toString(16).padStart(2, '0'), ((i * 5 + 1) % 256).toString(16).padStart(2, '0')].join(':').toUpperCase();
    const exp = new Date(now + (((i * 5) % 45) - 8) * 86400000).toISOString().slice(0, 10);   // some ended, some soon, some later
    users.push({
      id: 1000 + i, username: first.toLowerCase() + (i + 1) + '@lab', firstname: first, lastname: last,
      expiration: exp, phone: '0770' + String(1000000 + ((i * 7919) % 8999999)).slice(0, 7), last_online: new Date(now - (online ? 0 : 3600000 * (2 + i % 40))).toISOString().slice(0, 19).replace('T', ' '),
      name: plan.name, profile_details: { name: plan.name }, online_status: online ? 1 : 0, enabled: 1,
      plan, online, mac, ip: '10.50.' + (1 + (i % 4)) + '.' + (10 + (i % 200))
    });
  }
  return users;
}

function onlineRow(u, now, started) {
  const secs = Math.max(60, Math.round((now - started) / 1000) + (u.id * 37) % 5000);
  const rate = u.plan.down * 1e6 / 8 * 0.12;   // average bytes a second
  return { id: u.id, username: u.username, acctoutputoctets: String(Math.round(rate * secs)), acctinputoctets: String(Math.round(rate * secs * 0.15)),
    user_profile_name: u.plan.name, framedipaddress: u.ip, callingstationid: u.mac, acctsessiontime: String(secs), oui: 'Lab', firstname: u.firstname, lastname: u.lastname };
}

function createServer(opts) {
  opts = opts || {};
  const started = Date.now();
  const users = make(opts.count || 60, opts.macs || [], started);
  const user = opts.user || 'manager', pass = opts.pass || 'lab-pass';
  const token = crypto.randomBytes(16).toString('hex');
  return http.createServer((req, res) => {
    const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const m = /^\/admin\/api\/index\.php\/api\/(login|index\/online|index\/user)$/.exec(req.url.split('?')[0]);
    if (req.method !== 'POST' || !m) return send(404, { message: 'Not found' });
    let raw = '';
    req.on('data', (d) => { raw += d; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(sas4.decrypt(JSON.parse(raw).payload)); } catch (e) { return send(400, { message: 'Bad payload' }); }
      if (m[1] === 'login') return body.username === user && body.password === pass ? send(200, { status: 200, token }) : send(200, { status: 401, message: 'Invalid username or password' });
      if (req.headers.authorization !== 'Bearer ' + token) return send(401, { message: 'Unauthenticated' });
      const list = m[1] === 'index/online' ? users.filter((u) => u.online) : users;
      const count = Math.min(Number(body.count) || 100, 500), page = Math.max(1, Number(body.page) || 1);
      const slice = list.slice((page - 1) * count, page * count);
      const data = m[1] === 'index/online' ? slice.map((u) => onlineRow(u, Date.now(), started)) : slice.map(({ plan, online, mac, ip, ...row }) => row);
      return send(200, { data, current_page: page, last_page: Math.max(1, Math.ceil(list.length / count)), total: list.length });
    });
  });
}

module.exports = { createServer, make };

if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const macs = arg('macs') && fs.existsSync(arg('macs')) ? fs.readFileSync(arg('macs'), 'utf8').split(/\r?\n/).map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
  const port = Number(arg('port', 8085));
  createServer({ count: Number(arg('count', 60)), user: arg('user', 'manager'), pass: arg('pass', 'lab-pass'), macs }).listen(port, '127.0.0.1', () => {
    console.log('Pretend SAS 4 on http://127.0.0.1:' + port + '  (login ' + arg('user', 'manager') + ' / ' + arg('pass', 'lab-pass') + ', ' + arg('count', 60) + ' subscribers). Ctrl+C to stop.');
  });
}
