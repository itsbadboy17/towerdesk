// Types the lab configuration on the GNS3 consoles (telnet to the GNS3 VM, 192.168.229.128:<port>). Lab only.
const net = require('net');
const HOST = '192.168.229.128';
const PASS = 'Lab-pass-2026';
const PROMPT = /\]\s*>\s*$/;
const ERR = /(failure:|bad command name|syntax error|expected end of command|invalid value|input does not match|no such item)/i;
const bridge = (ports) => ['/interface bridge add name=bridge1 protocol-mode=none'].concat(ports.map((p) => '/interface bridge port add bridge=bridge1 interface=' + p));
const COMMON = (name) => ['/system identity set name=' + name, '/ip dhcp-client remove [find]'];
const GW = '10.10.11.1';
const NODES = {
  Gateway: { port: 5000, cmds: COMMON('Gateway').concat(['/ip address add address=10.10.11.1/24 interface=ether1']) },
  Master: { port: 5002, cmds: COMMON('Master').concat(bridge(['ether1', 'ether2']), ['/ip address add address=10.10.11.2/24 interface=bridge1', '/ip route add gateway=' + GW]) },
  Slave: { port: 5004, cmds: COMMON('Slave').concat(bridge(['ether1', 'ether2']), ['/ip address add address=10.10.11.3/24 interface=bridge1', '/ip route add gateway=' + GW]) },
  Sector1: { port: 5006, cmds: COMMON('Sector1').concat(['/ip address add address=10.10.11.10/24 interface=ether1', '/ip route add gateway=' + GW]) },
  Sector2: { port: 5008, cmds: COMMON('Sector2').concat(['/ip address add address=10.10.11.11/24 interface=ether1', '/ip route add gateway=' + GW]) },
  Sector3: { port: 5010, cmds: COMMON('Sector3').concat(['/ip address add address=10.10.11.12/24 interface=ether1', '/ip route add gateway=' + GW]) }
};
// New-MikroTik (port 5012) is deliberately not here: it stays exactly as it boots.
const CISCO = { port: 5014, cmds: ['configure terminal', 'hostname Cisco-SW', 'interface vlan 1', 'ip address 10.10.11.254 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway ' + GW, 'snmp-server community public RO', 'lldp run', 'end'] };

class Con {
  constructor(sock) {
    this.sock = sock; this.buf = ''; this.waiter = null;
    sock.on('data', (d) => {
      const s = Buffer.from(d).toString('latin1').replace(/\xff[\xfb-\xfe]./g, '').replace(/\xff./g, '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');
      this.buf += s; if (this.buf.length > 40000) this.buf = this.buf.slice(-20000); this._check();
    });
  }
  _check() { const w = this.waiter; if (!w) return; for (let i = 0; i < w.p.length; i++) if (w.p[i].test(this.buf)) { this.waiter = null; clearTimeout(w.t); const text = this.buf; this.buf = ''; return w.ok({ i, text }); } }
  wait(p, ms) { return new Promise((ok, bad) => { const t = setTimeout(() => { this.waiter = null; bad(new Error('timeout waiting for ' + p.map(String).join(' | ') + ' (last output: ' + this.buf.replace(/\s+/g, ' ').slice(-80) + ')')); }, ms); this.waiter = { p, ok, t }; this._check(); }); }
  send(line) { this.buf = ''; this.sock.write(line + '\r'); }
}
const connect = async (port) => { const sock = net.connect(port, HOST); await new Promise((ok, bad) => { sock.once('connect', ok); sock.once('error', bad); }); return new Con(sock); };

async function configureChr(name, spec) {
  const c = await connect(spec.port); const started = Date.now(); let state = null;
  const NEWPW = /new password\s*>\s*$/i;
  while (Date.now() - started < 12 * 60 * 1000 && !state) { c.sock.write('\r'); try { const r = await c.wait([/login:\s*$/i, PROMPT, NEWPW], 6000); state = ['login', 'prompt', 'newpw'][r.i]; } catch (e) { /* still installing/booting */ } }
  if (!state) throw new Error('never reached a login prompt');
  if (state === 'login') {
    c.send('admin+ct'); await c.wait([/password:\s*$/i], 20000); c.send('');
    const r = await c.wait([PROMPT, /\[Y\/n\]:\s*$/i, /login:\s*$/i, NEWPW], 40000);
    if (r.i === 1) { c.send('n'); const r2 = await c.wait([PROMPT, NEWPW], 30000); if (r2.i === 1) state = 'newpw'; }
    if (r.i === 2) throw new Error('login refused');
    if (r.i === 3) state = 'newpw';
  }
  if (state === 'newpw') {
    // RouterOS 6.49 makes you choose a password at the first login: use the lab password, twice.
    c.send(PASS);
    let r = await c.wait([PROMPT, NEWPW], 40000);
    if (r.i === 1) { c.send(PASS); await c.wait([PROMPT], 40000); }
  }
  for (const cmd of spec.cmds) {
    c.send(cmd); const r = await c.wait([PROMPT], 60000);
    if (ERR.test(r.text)) throw new Error('"' + cmd + '" -> ' + r.text.replace(/\s+/g, ' ').trim().slice(0, 140));
  }
  c.send('/user set admin password=' + PASS); await c.wait([PROMPT], 30000);
  c.send('/quit'); setTimeout(() => c.sock.destroy(), 800);
  return { name, commands: spec.cmds.length, seconds: Math.round((Date.now() - started) / 1000) };
}

async function configureCisco(spec) {
  const c = await connect(spec.port); const started = Date.now(); let ready = false;
  const IOS = /[\w-]+[>#]\s*$/;
  while (Date.now() - started < 6 * 60 * 1000 && !ready) {
    c.sock.write('\r');
    try {
      const r = await c.wait([/initial configuration dialog\? \[yes\/no\]:\s*$/i, IOS], 8000);
      if (r.i === 0) { c.send('no'); await c.wait([IOS], 60000); }
      ready = true;
    } catch (e) { /* still booting */ }
  }
  if (!ready) throw new Error('the switch never showed a prompt');
  c.send('enable'); await c.wait([/#\s*$/], 15000);
  for (const cmd of spec.cmds) { c.send(cmd); await c.wait([/[\w()-]+#\s*$/], 20000); }
  c.send('write memory'); await c.wait([/#\s*$/], 40000).catch(() => {});
  setTimeout(() => c.sock.destroy(), 500);
  return { name: 'Cisco-SW', commands: spec.cmds.length, seconds: Math.round((Date.now() - started) / 1000) };
}

(async () => {
  const only = process.argv.slice(2);
  const jobs = [];
  Object.keys(NODES).filter((n) => !only.length || only.includes(n)).forEach((n) => jobs.push(configureChr(n, NODES[n]).then((r) => ({ ok: true, ...r }), (e) => ({ ok: false, name: n, error: e.message }))));
  if (!only.length || only.includes('Cisco-SW')) jobs.push(configureCisco(CISCO).then((r) => ({ ok: true, ...r }), (e) => ({ ok: false, name: 'Cisco-SW', error: e.message })));
  (await Promise.all(jobs)).forEach((r) => console.log(r.ok ? 'OK    ' + r.name + ': ' + r.commands + ' commands in ' + r.seconds + ' s' : 'FAIL  ' + r.name + ': ' + r.error));
})();
