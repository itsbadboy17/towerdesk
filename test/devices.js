// Tests every real connection method against fake devices running on localhost,
// then exercises the /api/devices endpoints. Uses a temporary data dir.
const assert = require('node:assert');
const net = require('net');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'towerdesk-test-'));
process.env.TOWERDESK_DATA_DIR = tmp;

const transports = require('../src/transports');
const { encodeSentence, parseSentences } = require('../src/transports/mikrotik');

const USER = 'admin';
const PASS = crypto.randomBytes(8).toString('hex');
const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

// ---- Fake MikroTik API ----
const mtStats = { logins: 0, snmpEnabled: false, snmpAddedCommunity: null };
const startedAt = Date.now();
function fakeMikrotik() {
  return net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    let authed = false;
    sock.on('error', () => {}); // a probe may drop the connection mid-reply
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const { sentences, rest } = parseSentences(buf);
      buf = rest;
      for (const s of sentences) {
        if (s[0] === '/login') {
          const ok = s.includes('=name=' + USER) && s.includes('=password=' + PASS);
          authed = ok;
          if (ok) mtStats.logins++;
          sock.write(ok ? encodeSentence(['!done']) : encodeSentence(['!trap', '=message=invalid user name or password (6)']));
        } else if (!authed) {
          sock.write(encodeSentence(['!fatal', 'not logged in']));
        } else if (s[0] === '/system/identity/print') {
          sock.write(Buffer.concat([encodeSentence(['!re', '=name=TowerNorth']), encodeSentence(['!done'])]));
        } else if (s[0] === '/system/resource/print') {
          sock.write(Buffer.concat([encodeSentence(['!re', '=version=7.14', '=board-name=RB4011', '=uptime=3d4h', '=cpu-load=7', '=free-memory=500', '=total-memory=1000']), encodeSentence(['!done'])]));
        } else if (s[0] === '/snmp/community/print') {
          sock.write(Buffer.concat([encodeSentence(['!re', '=name=public']), encodeSentence(['!done'])]));
        } else if (s[0] === '/snmp/community/add') {
          mtStats.snmpAddedCommunity = (s.find((w) => w.startsWith('=name=')) || '').slice(6);
          sock.write(encodeSentence(['!done']));
        } else if (s[0] === '/snmp/community/set') {
          sock.write(encodeSentence(['!done']));
        } else if (s[0] === '/snmp/set') {
          if (s.includes('=enabled=yes')) mtStats.snmpEnabled = true;
          sock.write(encodeSentence(['!done']));
        } else if (s[0] === '/interface/wireless/registration-table/print') {
          // One station; the AP sends it ~2 Mbit/s and receives ~0.4 Mbit/s.
          const secs = (Date.now() - startedAt) / 1000;
          sock.write(Buffer.concat([
            encodeSentence(['!re', '=interface=wlan1', '=radio-name=CPE-Ali', '=mac-address=4C:5E:0C:AA:BB:01', '=last-ip=10.5.5.20', '=signal-strength=-61dBm@6Mbps', '=tx-ccq=93', '=tx-rate=144.4Mbps-20MHz/2S/SGI', '=rx-rate=130Mbps-20MHz/2S', '=bytes=' + Math.round(secs * 250000) + ',' + Math.round(secs * 50000)]),
            encodeSentence(['!done'])
          ]));
        } else if (s[0] === '/interface/print') {
          // ether1 moves ~10 Mbit/s down, 2 Mbit/s up.
          const secs = (Date.now() - startedAt) / 1000;
          sock.write(Buffer.concat([
            encodeSentence(['!re', '=name=ether1', '=type=ether', '=running=true', '=disabled=false', '=rx-byte=' + Math.round(secs * 1250000), '=tx-byte=' + Math.round(secs * 250000)]),
            encodeSentence(['!re', '=name=ether2', '=type=ether', '=running=false', '=disabled=false', '=rx-byte=0', '=tx-byte=0']),
            encodeSentence(['!done'])
          ]));
        }
      }
    });
  });
}

// ---- Fake Telnet login (sends option negotiation first, like real gear) ----
function fakeTelnet() {
  return net.createServer((sock) => {
    let stage = 'user';
    let user = '';
    sock.on('error', () => {}); // a probe may drop the connection mid-reply
    sock.write(Buffer.from([255, 251, 1, 255, 251, 3, 255, 253, 24]));
    sock.write('GPON ONU\r\nLogin: ');
    let line = '';
    sock.on('data', (d) => {
      const s = d.toString('latin1').replace(/\xff[\xfb-\xfe]./gs, '');
      line += s;
      if (!line.includes('\n')) return;
      const value = line.trim();
      line = '';
      if (stage === 'user') { user = value; stage = 'pass'; sock.write('Password: '); }
      else if (user === USER && value === PASS) sock.write('\r\nWAP>');
      else { stage = 'user'; sock.write('\r\nLogin incorrect\r\nLogin: '); }
    });
  });
}

// ---- Fake HTTP Basic-auth web UI ----
function fakeWeb() {
  return http.createServer((req, res) => {
    const expected = 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64');
    if (req.headers.authorization !== expected) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TP-LINK Archer C6"' });
      return res.end('<title>401</title>');
    }
    res.writeHead(200, { 'Content-Type': 'text/html', Server: 'Router Webserver' });
    res.end('<html><title>TL-WR840N</title></html>');
  });
}

// ---- Fake Ubiquiti airOS (login.cgi + status.cgi) ----
function fakeAiros() {
  const authed = 'AUTH' + Math.random().toString(16).slice(2);
  return http.createServer((req, res) => {
    const cookie = req.headers.cookie || '';
    if (req.url.startsWith('/login.cgi') && req.method === 'GET') {
      res.writeHead(200, { 'Set-Cookie': 'AIROS_SESSIONID=seed; path=/', 'Content-Type': 'text/html' });
      return res.end('<title>Login</title>');
    }
    if (req.url.startsWith('/login.cgi') && req.method === 'POST') {
      let body = '';
      req.on('data', (d) => { body += d; });
      req.on('end', () => {
        const u = (body.match(/name="username"\r\n\r\n([^\r]*)/) || [])[1];
        const p = (body.match(/name="password"\r\n\r\n([^\r]*)/) || [])[1];
        if (u === 'ubnt' && p === PASS) { res.writeHead(302, { 'Set-Cookie': 'AIROS_SESSIONID=' + authed + '; path=/', Location: '/' }); res.end(); }
        else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<title>Login</title>'); }
      });
      return;
    }
    if (req.url.startsWith('/status.cgi')) {
      if (cookie.indexOf('AIROS_SESSIONID=' + authed) >= 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          host: { hostname: 'tower-cpe-7', devmodel: 'NanoStation M5', fwversion: 'XW.v6.3.11', uptime: 90000, cpuload: 12, totalram: 64000000, freeram: 32000000 },
          wireless: { signal: -62, noisef: -96, ccq: 95, txrate: 130, rxrate: 130, frequency: '5500 MHz', chanbw: 40, txpower: 20, essid: 'towerlink', mode: 'sta' },
          interfaces: [{ ifname: 'eth0', enabled: true, status: { plugged: 1, rx_bytes: 1000000, tx_bytes: 500000 } }]
        }));
      }
      res.writeHead(302, { Location: '/login.cgi' });
      return res.end();
    }
    res.writeHead(404);
    res.end('404');
  });
}

// ---- Fake Mimosa (login.php + cgi/dashboard.php), password-only ----
function fakeMimosa() {
  const authed = 'M' + Math.random().toString(16).slice(2);
  return http.createServer((req, res) => {
    const cookie = req.headers.cookie || '';
    if (req.url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Set-Cookie': 'PHPSESSID=seed; path=/', 'Content-Type': 'text/html' });
      return res.end('<title>C5c</title>');
    }
    if (req.url === '/login.php' && req.method === 'POST') {
      let b = '';
      req.on('data', (d) => { b += d; });
      req.on('end', () => {
        const u = decodeURIComponent((b.match(/username=([^&]*)/) || [])[1] || '');
        const p = decodeURIComponent((b.match(/password=([^&]*)/) || [])[1] || '');
        // Real Mimosa: fixed account "configure"; 200 on success, 401 on a wrong password.
        if (u === 'configure' && p === PASS) { res.writeHead(200, { 'Set-Cookie': 'PHPSESSID=' + authed + '; path=/', 'Content-Type': 'application/json' }); res.end('{"unitSystem":"Metric","productName":"C5c"}'); }
        else { res.writeHead(401); res.end(''); }
      });
      return;
    }
    if (req.url === '/cgi/dashboard.php') {
      if (cookie.indexOf('PHPSESSID=' + authed) >= 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          realtime: {
            device_info: { DeviceName: 'PtP-North', Model: 'C02', productName: 'C5c', Version: '2.9.0', Temperature: '45', SerialNumber: 'X1' },
            signalmeter: { Chains_1_2: '5500 MHz', noise: '-90', get_phy: 'rxpackets=10&rssi_average=-45&noise=-92&tx_phy_rate=300&rx_phy_rate=390', BandWidth: '1x80', OperatingBand: '', tx_power: '27', ActualTotalTxPower: '27' },
            throughput: { throughput: '1000:11425000,2000:28562500' },
            connection: { connected: '1', linkName: 'North-Link', distance: '3200', availability: '99.98', SSID: 'HRINS' },
            remote_info: { DeviceName: 'PtP-South', Model: 'C5c', Remote_PER: '0.1' }
          }, config: {}
        }));
      }
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    res.writeHead(404);
    res.end('404');
  });
}

// ---- Fake SSH server ----
function fakeSsh() {
  const { Server } = require('ssh2');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  return new Server({ hostKeys: [privateKey], ident: 'ROSSSH' }, (client) => {
    client.on('authentication', (ctx) => {
      if (ctx.method === 'password' && ctx.username === USER && ctx.password === PASS) return ctx.accept();
      ctx.reject(['password']);
    });
    client.on('ready', () => {});
    client.on('error', () => {});
  });
}

// ---- Fake SNMP agent ----
function fakeSnmp(port) {
  const snmp = require('net-snmp');
  const agent = snmp.createAgent({ port, address: '127.0.0.1' }, () => {});
  agent.getAuthorizer().addCommunity('tower-ro');
  const mib = agent.getMib();
  const scalar = (name, oid, type) => mib.registerProvider({ name, type: snmp.MibProviderType.Scalar, oid, scalarType: type, maxAccess: snmp.MaxAccess['read-only'], handler: (r) => r.done() });
  scalar('sysDescr', '1.3.6.1.2.1.1.1', snmp.ObjectType.OctetString);
  scalar('sysUpTime', '1.3.6.1.2.1.1.3', snmp.ObjectType.TimeTicks);
  scalar('sysName', '1.3.6.1.2.1.1.5', snmp.ObjectType.OctetString);
  scalar('sysObjectID', '1.3.6.1.2.1.1.2', snmp.ObjectType.OID);
  mib.setScalarValue('sysDescr', 'Mimosa B5c 2.8.0');
  mib.setScalarValue('sysObjectID', '1.3.6.1.4.1.43356.1.1');
  mib.setScalarValue('sysUpTime', 8640000);
  mib.setScalarValue('sysName', 'backhaul-1');
  // IF-MIB::ifTable with one interface whose 32-bit counters grow ~4 Mbit/s down, 1 Mbit/s up.
  const col = (number, name, type, access) => ({ number, name, type, maxAccess: snmp.MaxAccess[access || 'read-only'] });
  mib.registerProvider({
    name: 'ifTable', type: snmp.MibProviderType.Table, oid: '1.3.6.1.2.1.2.2.1', maxAccess: snmp.MaxAccess['not-accessible'],
    tableColumns: [col(1, 'ifIndex', snmp.ObjectType.Integer), col(2, 'ifDescr', snmp.ObjectType.OctetString), col(8, 'ifOperStatus', snmp.ObjectType.Integer),
      col(10, 'ifInOctets', snmp.ObjectType.Counter), col(16, 'ifOutOctets', snmp.ObjectType.Counter)],
    tableIndex: [{ columnName: 'ifIndex' }],
    handler: (r) => r.done()
  });
  mib.addTableRow('ifTable', [1, 'radio0', 1, 0, 0]);
  agent.counterTimer = setInterval(() => {
    const secs = (Date.now() - startedAt) / 1000;
    mib.setTableSingleCell('ifTable', 10, [1], Math.round(secs * 500000) % 4294967296);
    mib.setTableSingleCell('ifTable', 16, [1], Math.round(secs * 125000) % 4294967296);
  }, 100);
  return agent;
}

async function freeUdpPort() {
  const dgram = require('dgram');
  return new Promise((r) => {
    const s = dgram.createSocket('udp4');
    s.bind(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); });
  });
}

(async () => {
  const host = '127.0.0.1';
  const mt = fakeMikrotik(); const mtPort = await listen(mt);
  const tn = fakeTelnet(); const tnPort = await listen(tn);
  const web = fakeWeb(); const webPort = await listen(web);
  const sshSrv = fakeSsh(); const sshPort = await listen(sshSrv);
  const airosSrv = fakeAiros(); const airosPort = await listen(airosSrv);
  const mimosaSrv = fakeMimosa(); const mimosaPort = await listen(mimosaSrv);
  const snmpPort = await freeUdpPort(); const agent = fakeSnmp(snmpPort);
  const closedPort = await (async () => { const s = net.createServer(); const p = await listen(s); s.close(); return p; })();

  const results = {};
  const t = async (name, opts) => { results[name] = await transports.test({ host, ...opts }); return results[name]; };

  // MikroTik API
  let r = await t('mikrotik ok', { method: 'mikrotik', port: mtPort, username: USER, password: PASS });
  assert.ok(r.ok, 'mikrotik ok: ' + r.error);
  assert.strictEqual(r.details.version, '7.14');
  assert.strictEqual(r.details.identity, 'TowerNorth');
  r = await t('mikrotik bad', { method: 'mikrotik', port: mtPort, username: USER, password: 'wrong' });
  assert.ok(!r.ok && /Wrong username or password/.test(r.error), 'mikrotik bad: ' + r.error);

  // Telnet
  r = await t('telnet ok', { method: 'telnet', port: tnPort, username: USER, password: PASS });
  assert.ok(r.ok, 'telnet ok: ' + r.error);
  r = await t('telnet bad', { method: 'telnet', port: tnPort, username: USER, password: 'wrong' });
  assert.ok(!r.ok && /Wrong/.test(r.error), 'telnet bad: ' + r.error);

  // SSH
  r = await t('ssh ok', { method: 'ssh', port: sshPort, username: USER, password: PASS });
  assert.ok(r.ok, 'ssh ok: ' + r.error);
  assert.strictEqual(r.vendor, 'mikrotik', 'ssh vendor from ROSSSH ident');
  r = await t('ssh bad', { method: 'ssh', port: sshPort, username: USER, password: 'wrong' });
  assert.ok(!r.ok, 'ssh bad should fail');

  // HTTP
  r = await t('http no creds', { method: 'http', port: webPort });
  assert.ok(r.ok && r.vendor === 'tplink', 'http vendor: ' + JSON.stringify(r));
  r = await t('http ok', { method: 'http', port: webPort, username: USER, password: PASS });
  assert.ok(r.ok && /login OK/.test(r.summary), 'http basic ok: ' + JSON.stringify(r));
  r = await t('http bad', { method: 'http', port: webPort, username: USER, password: 'wrong' });
  assert.ok(!r.ok, 'http bad should fail');

  // SNMP interface counters (32-bit ifTable fallback)
  const snmpReader = require('../src/transports/snmp');
  const ifs = await snmpReader.readInterfaces({ host, port: snmpPort, community: 'tower-ro' });
  assert.ok(ifs.length === 1 && ifs[0].name === 'radio0' && ifs[0].up && ifs[0].counterBits === 32, 'snmp ifTable: ' + JSON.stringify(ifs));

  // SNMP
  r = await t('snmp ok', { method: 'snmp', port: snmpPort, community: 'tower-ro' });
  assert.ok(r.ok && r.details.name === 'backhaul-1', 'snmp ok: ' + JSON.stringify(r));
  assert.strictEqual(r.details.uptime, '1d 0h 0m');
  assert.strictEqual(snmpReader.vendorFromObjectId(r.details.objectId), 'mimosa', 'vendor from sysObjectID: ' + r.details.objectId);
  assert.strictEqual(snmpReader.vendorFromObjectId('1.3.6.1.4.1.14988.1'), 'mikrotik');
  assert.strictEqual(snmpReader.vendorFromObjectId('1.3.6.1.4.1.99999.1'), null);

  // Network scan range parsing
  const discovery = require('../src/discovery');
  assert.strictEqual(discovery.parseRange('192.168.1.0/24').length, 253, '/24 skips network, broadcast and the .1 gateway');
  assert.deepStrictEqual(discovery.parseRange('10.0.0.1-3'), ['10.0.0.2', '10.0.0.3']); // .1 gateway skipped in a range
  assert.deepStrictEqual(discovery.parseRange('192.168.1.1'), ['192.168.1.1']); // a single .1 on purpose is kept
  assert.deepStrictEqual(discovery.parseRange('100.64.0.9-100.64.0.10'), ['100.64.0.9', '100.64.0.10']);
  assert.deepStrictEqual(discovery.parseRange('172.16.5.4/32'), ['172.16.5.4']);
  for (const bad of ['8.8.8.0/24', '10.0.0.0/16', '10.0.0.9-3', '10.0.0.1-300', 'abc', '', '10.0.1.0-10.0.3.0']) {
    assert.throws(() => discovery.parseRange(bad), undefined, 'range should be rejected: ' + bad);
  }

  // Credential vault: store once, never leak the secret, decrypt only server-side.
  const credentials = require('../src/credentials');
  credentials.addLogin({ label: 'Wrong', username: 'admin', password: 'definitely-not-it' });
  credentials.addLogin({ label: 'Main', username: USER, password: PASS });
  credentials.addCommunity({ label: 'RO', community: 'tower-ro' });
  const pubVault = credentials.list();
  assert.ok(pubVault.logins.length === 2 && pubVault.communities.length === 1, 'vault list');
  assert.ok(!('secret' in pubVault.logins[0]) && !('password' in pubVault.logins[0]), 'vault list hides the secret');
  assert.strictEqual(credentials.resolved().logins[1].password, PASS, 'resolved() decrypts for server use');
  assert.ok(!fs.readFileSync(path.join(tmp, 'credentials.json'), 'utf8').includes(PASS), 'vault stored in plain text');

  // Auto-try: picks the right method and the working credential, skipping the wrong one.
  const vault = credentials.resolved();
  let probe = await transports.probeCredentials({ host, method: 'mikrotik', port: mtPort, vendor: 'mikrotik', logins: vault.logins, communities: vault.communities });
  assert.ok(probe.ok && probe.method === 'mikrotik' && probe.label === 'Main', 'probe mikrotik: ' + JSON.stringify({ ok: probe.ok, method: probe.method, label: probe.label }));
  probe = await transports.probeCredentials({ host, method: 'telnet', port: tnPort, vendor: 'onu', logins: vault.logins, communities: vault.communities });
  assert.ok(probe.ok && probe.method === 'telnet' && probe.label === 'Main', 'probe telnet: ' + JSON.stringify({ ok: probe.ok, method: probe.method, label: probe.label }));
  probe = await transports.probeCredentials({ host, method: 'snmp', port: snmpPort, vendor: 'mimosa', logins: vault.logins, communities: vault.communities });
  assert.ok(probe.ok && probe.method === 'snmp' && probe.label === 'RO', 'probe snmp: ' + JSON.stringify({ ok: probe.ok, method: probe.method, label: probe.label }));
  probe = await transports.probeCredentials({ host, method: 'mikrotik', port: closedPort, vendor: 'mikrotik', logins: [{ label: 'Wrong', username: 'admin', password: 'no' }], communities: [] });
  assert.ok(!probe.ok, 'probe fails cleanly when nothing matches');
  r = await t('snmp bad community', { method: 'snmp', port: snmpPort, community: 'wrong' });
  assert.ok(!r.ok, 'snmp wrong community should fail');

  // TP-Link web login (fake router implementing the protocol from the real router's UI code)
  const { createFakeTplink } = require('./tplink-fake');
  const tpFake = createFakeTplink({ password: PASS });
  const tpPort = await listen(tpFake.server);
  r = await t('tplink ok', { method: 'tplink', port: tpPort, password: PASS });
  assert.ok(r.ok && r.details.clients === 2 && r.details.cpu === '12%', 'tplink ok: ' + JSON.stringify(r));
  assert.strictEqual(tpFake.stats.logouts, 1, 'tplink test logs out afterwards');
  r = await t('tplink bad', { method: 'tplink', port: tpPort, password: 'wrong' });
  assert.ok(!r.ok && /Wrong router password/.test(r.error), 'tplink bad: ' + r.error);
  tpFake.stats.busy = true;
  r = await t('tplink admin busy', { method: 'tplink', port: tpPort, password: PASS });
  assert.ok(!r.ok && r.errorKind === 'busy', 'tplink must not kick an admin who is logged in: ' + JSON.stringify(r));
  tpFake.stats.busy = false;
  r = await t('tplink via Web UI', { method: 'http', type: 'tplink', port: tpPort, password: PASS });
  assert.ok(r.ok && /Router login OK/.test(r.summary), 'TP-Link saved as Web UI with password uses the router login');

  // Ubiquiti airOS web login (login.cgi -> status.cgi JSON). Tested over http against the fake.
  const airosT = require('../src/transports/airos');
  let ar = await airosT.test({ host, port: airosPort, secure: false, username: 'ubnt', password: PASS });
  assert.ok(ar.ok && ar.details.model === 'NanoStation M5' && ar.details.name === 'tower-cpe-7', 'airos ok: ' + JSON.stringify(ar));
  assert.ok(/-62 dBm/.test(ar.details.signal), 'airos signal: ' + JSON.stringify(ar.details));
  ar = await airosT.test({ host, port: airosPort, secure: false, username: 'ubnt', password: 'wrong' });
  assert.ok(!ar.ok && /Wrong username or password/.test(ar.error), 'airos bad: ' + ar.error);
  const airosSess = await airosT.AirosSession.open({ host, port: airosPort, secure: false, username: 'ubnt', password: PASS });
  const airosStats = await airosSess.readStats();
  assert.ok(airosStats.interfaces.length === 1 && airosStats.interfaces[0].name === 'eth0' && airosStats.interfaces[0].rxBytes === 1000000 && airosStats.cpu === 12 && airosStats.memPct === 50, 'airos stats: ' + JSON.stringify(airosStats));
  assert.ok(airosStats.radio.snr === 34 && airosStats.radio.txRate === 130 && airosStats.radio.freq === '5500 MHz' && airosStats.radio.chanbw === 40, 'airos radio: ' + JSON.stringify(airosStats.radio));
  await airosSess.logout();
  results['airos ok'] = { ok: true, summary: 'airOS login OK (NanoStation M5)' };

  // Mimosa web login (password-only; login.php -> cgi/dashboard.php JSON)
  const mimosaT = require('../src/transports/mimosa');
  let mr = await mimosaT.test({ host, port: mimosaPort, password: PASS });
  assert.ok(mr.ok && mr.details.model === 'C5c' && mr.details.name === 'PtP-North' && mr.details.remote === 'PtP-South', 'mimosa ok: ' + JSON.stringify(mr));
  mr = await mimosaT.test({ host, port: mimosaPort, password: 'wrong' });
  assert.ok(!mr.ok && /Wrong password/.test(mr.error), 'mimosa bad: ' + mr.error);
  const mimosaSess = await mimosaT.MimosaSession.connect({ host, port: mimosaPort, password: PASS });
  const mimosaStats = await mimosaSess.readStats();
  await mimosaSess.logout();
  assert.ok(mimosaStats.radio.signal === -45 && mimosaStats.radio.snr === 47 && mimosaStats.radio.txRate === 300 && mimosaStats.radio.rxRate === 390 && mimosaStats.radio.linkName === 'North-Link' && mimosaStats.radio.distance === 3.2 && mimosaStats.throughput === 228.5 && mimosaStats.radio.remoteName === 'PtP-South' && mimosaStats.model === 'C5c', 'mimosa stats: ' + JSON.stringify(mimosaStats));
  results['mimosa ok'] = { ok: true, summary: 'Mimosa login OK (C5c)' };

  // Ping + closed port + invalid host
  r = await t('ping localhost', { method: 'ping' });
  assert.ok(r.ok, 'ping localhost: ' + r.error);
  r = await t('closed port', { method: 'ssh', port: closedPort, username: USER, password: PASS });
  assert.ok(!r.ok && /refused/i.test(r.error), 'closed port: ' + r.error);
  r = await transports.test({ host: 'bad host;rm', method: 'ping' });
  assert.ok(!r.ok && /Invalid/.test(r.error));

  // No result may contain the password.
  assert.ok(!JSON.stringify(results).includes(PASS), 'password leaked into a result');

  // ---- HTTP API against a real server process ----
  const port = 3000 + 100 + Math.floor(Math.random() * 800);
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), TOWERDESK_AUTH: 'off', TOWERDESK_DATA_DIR: tmp, TOWERDESK_MONITOR_MS: '400', TOWERDESK_HISTORY: 'off' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  srv.stdout.on('data', (d) => { serverLog += d; });
  srv.stderr.on('data', (d) => { serverLog += d; });
  const base = 'http://127.0.0.1:' + port;
  const call = (m, u, b) => fetch(base + u, { method: m, headers: b ? { 'Content-Type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined })
    .then(async (res) => ({ status: res.status, body: await res.json() }));
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(base + '/api/devices'); break; } catch (e) { await new Promise((q) => setTimeout(q, 150)); } }
    let res = await call('POST', '/api/devices', { name: 'Core', type: 'mikrotik', ip: host, method: 'mikrotik', port: mtPort, username: USER, password: PASS });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.test.ok, 'save+test: ' + res.body.test.error);
    const id = res.body.device.id;
    assert.ok(res.body.device.hasPassword && !('secret' in res.body.device));

    res = await call('GET', '/api/devices');
    assert.strictEqual(res.body.length, 1);
    res = await call('POST', '/api/devices/' + id + '/check');
    assert.ok(res.body.test.ok, 'check: ' + res.body.test.error);
    const loginsBeforePolling = mtStats.logins;

    res = await call('POST', '/api/devices/detect', { ip: host });
    assert.ok(res.body.ok && res.body.ping.alive, 'detect localhost');

    res = await call('POST', '/api/devices', { name: 'x', type: 'tplink', ip: 'bad host;rm' });
    assert.strictEqual(res.status, 400);
    res = await call('POST', '/api/devices', { name: 'x' });
    assert.strictEqual(res.status, 400);

    const onDisk = fs.readFileSync(path.join(tmp, 'devices.json'), 'utf8');
    assert.ok(!onDisk.includes(PASS), 'password stored in plain text');
    assert.ok(!serverLog.includes(PASS), 'password written to server log');

    // Same IP + method again is refused.
    res = await call('POST', '/api/devices', { name: 'Core again', type: 'mikrotik', ip: host, method: 'mikrotik', port: mtPort, username: USER, password: PASS });
    assert.strictEqual(res.status, 409, 'duplicate should be refused');

    // SNMP device for traffic graphs.
    res = await call('POST', '/api/devices', { name: 'Backhaul', type: 'mimosa', ip: host, method: 'snmp', port: snmpPort, community: 'tower-ro' });
    assert.ok(res.body.test && res.body.test.ok, 'snmp device save: ' + JSON.stringify(res.body));
    const snmpId = res.body.device.id;
    assert.ok(!JSON.stringify(res.body).includes('tower-ro'), 'community leaked');

    // Live monitor: device online, traffic rates computed, then offline after its service stops.
    const sleep = (q) => new Promise((z) => setTimeout(z, q));
    await sleep(2000);
    res = await call('GET', '/api/monitor');
    let live = res.body.devices.find((x) => x.id === id);
    assert.ok(live && live.online === true && live.history.length >= 2, 'monitor online: ' + JSON.stringify(live));
    assert.ok(live.uptimePct === 100);

    const m = live.metrics;
    assert.ok(m && !m.error && m.interfaces.length === 2, 'mikrotik metrics: ' + JSON.stringify(m));
    const e1 = m.interfaces[0];
    assert.strictEqual(e1.name, 'ether1', 'busiest interface first');
    assert.ok(e1.rxBps > 8e6 && e1.rxBps < 12e6, 'ether1 rx ~10 Mbit/s, got ' + e1.rxBps);
    assert.ok(e1.txBps > 1.5e6 && e1.txBps < 2.5e6, 'ether1 tx ~2 Mbit/s, got ' + e1.txBps);
    assert.strictEqual(m.cpu.now, 7);
    assert.strictEqual(m.memPct, 50);
    // MikroTik sector: the wireless registration table becomes the station list, with live rates.
    const sta = m.stations && m.stations[0];
    assert.ok(m.kind === 'stations' && m.stationCount === 1 && sta, 'mikrotik registration table: ' + JSON.stringify(m.stations));
    assert.ok(sta.mac === '4C:5E:0C:AA:BB:01' && sta.name === 'CPE-Ali' && sta.signal === -61 && sta.ccq === 93 && sta.txRate === 144.4 && sta.rxRate === 130, 'mikrotik station fields: ' + JSON.stringify(sta));
    assert.ok(sta.txBps > 1.5e6 && sta.txBps < 2.5e6 && sta.rxBps > 3e5 && sta.rxBps < 5e5, 'mikrotik station rates: ' + JSON.stringify(sta));
    assert.strictEqual(live.role, 'sector', 'a MikroTik with registered stations is a sector');
    // ~5 polls in 2 s must share one persistent API session (at most one login).
    assert.ok(mtStats.logins - loginsBeforePolling <= 1, 'polling must reuse one API session, saw ' + (mtStats.logins - loginsBeforePolling) + ' logins');

    // TP-Link live traffic = sum of client speeds (bytes/s × 8), one persistent login.
    const tpLoginsBefore = tpFake.stats.logins;
    res = await call('POST', '/api/devices', { name: 'Home AX12', type: 'tplink', ip: host, method: 'tplink', port: tpPort, password: PASS });
    assert.ok(res.body.test && res.body.test.ok, 'tplink device save: ' + JSON.stringify(res.body));
    const tpId = res.body.device.id;
    await sleep(1500);
    res = await call('GET', '/api/monitor');
    const tm = res.body.devices.find((x) => x.id === tpId).metrics;
    assert.ok(tm && !tm.error && tm.kind === 'clients' && tm.clientCount === 2, 'tplink metrics: ' + JSON.stringify(tm));
    assert.ok(tm.interfaces[0].rxBps >= 10e6 && tm.interfaces[0].rxBps < 10.2e6, 'total down = (500000+750000)*8, got ' + tm.interfaces[0].rxBps);
    assert.strictEqual(tm.clients[0].name, 'Laptop', 'busiest client first');
    assert.strictEqual(tm.cpu.now, 12);
    assert.strictEqual(tm.memPct, 43);
    // 1 login for the save test + 1 persistent polling session, despite several polls.
    assert.ok(tpFake.stats.logins - tpLoginsBefore <= 2, 'tplink polling must reuse its session, saw ' + (tpFake.stats.logins - tpLoginsBefore));
    res = await call('DELETE', '/api/devices/' + tpId);
    assert.strictEqual(res.status, 200);

    const sm = (await call('GET', '/api/monitor')).body.devices.find((x) => x.id === snmpId).metrics;
    assert.ok(sm && !sm.error && sm.interfaces[0].name === 'radio0', 'snmp metrics: ' + JSON.stringify(sm));
    assert.ok(sm.interfaces[0].rxBps > 3e6 && sm.interfaces[0].rxBps < 5e6, 'radio0 rx ~4 Mbit/s, got ' + sm.interfaces[0].rxBps);

    res = await call('GET', '/api/alerts/summary');
    assert.strictEqual(res.body.active, 0, 'no alerts while healthy');

    await new Promise((z) => mt.close(z));
    let wentOffline = false;
    for (let i = 0; i < 20 && !wentOffline; i++) {
      await sleep(300);
      res = await call('GET', '/api/monitor');
      wentOffline = res.body.events.some((e) => e.id === id && e.online === false);
    }
    assert.ok(wentOffline, 'offline event recorded');
    live = res.body.devices.find((x) => x.id === id);
    assert.strictEqual(live.online, false);
    assert.strictEqual(res.body.summary.offline, 1);

    // Offline raises a critical alert; acknowledging works; coming back resolves it.
    res = await call('GET', '/api/alerts');
    let alert = res.body.alerts.find((a) => a.deviceId === id && !a.resolvedAt);
    assert.ok(alert && alert.severity === 'critical' && alert.kind === 'offline', 'offline alert: ' + JSON.stringify(res.body));
    assert.strictEqual(res.body.summary.critical, 1);
    res = await call('POST', '/api/alerts/' + alert.id + '/ack');
    assert.ok(res.body.alert.acknowledgedAt);
    await new Promise((z) => mt.listen(mtPort, '127.0.0.1', z));
    let resolved = false;
    for (let i = 0; i < 20 && !resolved; i++) {
      await sleep(300);
      res = await call('GET', '/api/alerts');
      resolved = res.body.alerts.some((a) => a.id === alert.id && a.resolvedAt);
    }
    assert.ok(resolved, 'alert resolved when device came back');
    assert.strictEqual(res.body.summary.active, 0);

    res = await call('DELETE', '/api/devices/' + snmpId);
    assert.strictEqual(res.status, 200);
    res = await call('DELETE', '/api/devices/' + id);
    assert.strictEqual(res.status, 200);
    res = await call('GET', '/api/devices');
    assert.strictEqual(res.body.length, 0);
    res = await call('GET', '/api/monitor');
    assert.strictEqual(res.body.devices.length, 0, 'deleted device gone from monitor');

    // Network scan API: rejects public / too-large ranges, finds the local host, never echoes the community.
    res = await call('POST', '/api/discovery', { range: '8.8.8.0/24' });
    assert.strictEqual(res.status, 400, 'public range rejected');
    res = await call('POST', '/api/discovery', { range: '10.0.0.0/16' });
    assert.strictEqual(res.status, 400, '/16 rejected');
    res = await call('POST', '/api/discovery', { range: '127.0.0.1', community: 'scan-secret' });
    assert.strictEqual(res.status, 202, 'scan started: ' + JSON.stringify(res.body));
    const scanId = res.body.id;
    for (let i = 0; i < 40 && res.body.status === 'running'; i++) {
      await sleep(500);
      res = await call('GET', '/api/discovery/' + scanId);
    }
    assert.strictEqual(res.body.status, 'done', 'scan finished: ' + JSON.stringify(res.body));
    assert.ok(res.body.scanned === 1 && res.body.found.length === 1 && res.body.found[0].ip === '127.0.0.1', 'scan found localhost: ' + JSON.stringify(res.body));
    assert.ok(!JSON.stringify(res.body).includes('scan-secret'), 'scan never returns the SNMP community');
    res = await call('GET', '/api/discovery/scan-nope');
    assert.strictEqual(res.status, 404);

    // Credential vault API + auto-try on add. The vault (Main = admin/PASS) was saved earlier and
    // the server shares this data dir. Adding a telnet device with tryVault and no password must
    // find and save the working login, without the password ever reaching the client.
    res = await call('GET', '/api/credentials');
    assert.ok(res.body.logins.length >= 2 && !JSON.stringify(res.body).includes(PASS), 'vault API hides secrets: ' + JSON.stringify(res.body));
    res = await call('POST', '/api/devices', { name: 'Auto ONU', type: 'onu', ip: host, method: 'telnet', port: tnPort, tryVault: true });
    assert.ok(res.body.test && res.body.test.ok && res.body.matched === 'Main', 'tryVault auto-login: ' + JSON.stringify(res.body));
    assert.ok(res.body.device.hasPassword && !JSON.stringify(res.body).includes(PASS), 'matched login saved, not leaked');
    res = await call('POST', '/api/credentials', { kind: 'community', label: 'Temp', community: 'zzz' });
    assert.strictEqual((await call('DELETE', '/api/credentials/' + res.body.item.id)).status, 200);
    assert.strictEqual((await call('DELETE', '/api/credentials/nope')).status, 404);

    // Enable SNMP on a MikroTik (the one write action). It must log in, add the missing community,
    // turn SNMP on, and — since there's no SNMP agent at 127.0.0.1:161 here — report that it could
    // not read it back yet and leave the method unchanged. The community value is never echoed.
    res = await call('POST', '/api/devices', { name: 'Edge MT', type: 'mikrotik', ip: host, method: 'mikrotik', port: mtPort, username: USER, password: PASS });
    const edgeId = res.body.device.id;
    mtStats.snmpEnabled = false; mtStats.snmpAddedCommunity = null;
    res = await call('POST', '/api/devices/' + edgeId + '/enable-snmp', { community: 'scan-ro' });
    assert.ok(res.body.enabled === true && typeof res.body.verified === 'boolean', 'enable-snmp result: ' + JSON.stringify(res.body));
    assert.ok(mtStats.snmpEnabled && mtStats.snmpAddedCommunity === 'scan-ro', 'router received enable + community add: ' + JSON.stringify(mtStats));
    assert.ok(!JSON.stringify(res.body).includes('scan-ro'), 'enable-snmp must not echo the community value');
    if (!res.body.verified) {
      const after = (await call('GET', '/api/devices')).body.find((x) => x.id === edgeId);
      assert.strictEqual(after.method, 'mikrotik', 'method unchanged when SNMP cannot be read back');
    }
    // Not a MikroTik -> refused (reuse the ONU added in the vault test, avoid a duplicate).
    const onu = (await call('GET', '/api/devices')).body.find((x) => x.type === 'onu');
    res = await call('POST', '/api/devices/' + onu.id + '/enable-snmp', {});
    assert.strictEqual(res.status, 400, 'enable-snmp only for MikroTik');
  } finally {
    srv.kill();
    mt.close(); tn.close(); web.close(); sshSrv.close(); airosSrv.close(); mimosaSrv.close(); tpFake.server.close(); clearInterval(agent.counterTimer); agent.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  for (const [k, v] of Object.entries(results)) console.log(`pass  ${k.padEnd(20)} ${v.ok ? 'connected: ' + v.summary : 'rejected as expected: ' + v.error}`);
  console.log('Device connection tests passed.');
  process.exit(0);
})().catch((e) => {
  console.error('DEVICE TEST FAILED:', e.message);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
