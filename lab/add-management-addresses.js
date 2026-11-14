// Adds a management address (192.168.229.x) to each lab router so the PC can reach it. Lab only.
const net = require('net');
const HOST = '192.168.229.128';
const PASS = 'Lab-pass-2026';
const PROMPT = /\]\s*>\s*$/;
const CHR = { Gateway: [5000, 21, 'ether1'], Master: [5002, 22, 'bridge1'], Slave: [5004, 23, 'bridge1'], Sector1: [5006, 31, 'ether1'], Sector2: [5008, 32, 'ether1'], Sector3: [5010, 33, 'ether1'] };

function session(port) {
  return new Promise((ok, bad) => {
    const s = net.connect(port, HOST); let buf = '', waiter = null;
    s.on('error', bad);
    s.on('data', (d) => { buf += Buffer.from(d).toString('latin1').replace(/\xff[\xfb-\xfe]./g, '').replace(/\xff./g, '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, ''); if (waiter && waiter.re.test(buf)) { const w = waiter; waiter = null; clearTimeout(w.t); const t = buf; buf = ''; w.ok(t); } });
    const wait = (re, ms) => new Promise((o, b) => { const t = setTimeout(() => { waiter = null; b(new Error('timeout (' + buf.replace(/\s+/g, ' ').slice(-60) + ')')); }, ms); waiter = { re, ok: o, t }; if (re.test(buf)) { const x = buf; buf = ''; clearTimeout(t); waiter = null; o(x); } });
    s.on('connect', () => ok({ s, wait, send: (l) => { buf = ''; s.write(l + '\r'); } }));
  });
}
async function chr(name, [port, last, iface]) {
  const c = await session(port);
  c.send(''); let r = await c.wait(/login:\s*$|\]\s*>\s*$/i, 15000);
  if (/login:/i.test(r)) { c.send('admin+ct'); await c.wait(/password:\s*$/i, 15000); c.send(PASS); await c.wait(PROMPT, 20000); }
  c.send('/ip address add address=192.168.229.' + last + '/24 interface=' + iface + ' comment=lab-management'); const out = await c.wait(PROMPT, 20000);
  if (/failure|invalid|bad command/i.test(out)) throw new Error(out.replace(/\s+/g, ' ').slice(0, 120));
  c.send('/quit'); setTimeout(() => c.s.destroy(), 500);
  return name + ' -> 192.168.229.' + last;
}
async function cisco() {
  const c = await session(5014);
  c.send(''); await c.wait(/[\w-]+[>#]\s*$/, 15000);
  c.send('enable'); await c.wait(/#\s*$/, 10000);
  for (const l of ['configure terminal', 'interface vlan 1', 'ip address 192.168.229.24 255.255.255.0 secondary', 'end']) { c.send(l); await c.wait(/[\w()-]+#\s*$/, 15000); }
  c.send('write memory'); await c.wait(/#\s*$/, 30000).catch(() => {});
  setTimeout(() => c.s.destroy(), 500);
  return 'Cisco-SW -> 192.168.229.24 (secondary on vlan 1)';
}
(async () => {
  const jobs = Object.keys(CHR).map((n) => chr(n, CHR[n]).catch((e) => n + ' FAILED: ' + e.message));
  jobs.push(cisco().catch((e) => 'Cisco-SW FAILED: ' + e.message));
  (await Promise.all(jobs)).forEach((l) => console.log(l));
})();
