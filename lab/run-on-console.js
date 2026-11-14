// Read-only helper: runs a few commands on one lab console and prints the output.  node exec-console.js <port> "<cmd>" ...
const net = require('net');
const HOST = '192.168.229.128';
const PROMPT = /\]\s*>\s*$/;
const port = Number(process.argv[2]);
const cmds = process.argv.slice(3);
const s = net.connect(port, HOST);
let buf = '', waiter = null;
s.on('data', (d) => { buf += Buffer.from(d).toString('latin1').replace(/\xff[\xfb-\xfe]./g, '').replace(/\xff./g, '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, ''); if (waiter && PROMPT.test(buf)) { const w = waiter; waiter = null; w(); } });
const wait = (ms) => new Promise((ok) => { const t = setTimeout(() => { waiter = null; ok(); }, ms); waiter = () => { clearTimeout(t); ok(); }; });
s.on('connect', async () => {
  s.write('\r'); await wait(4000);
  if (/login:\s*$/i.test(buf)) { buf = ''; s.write('admin+ct\r'); await new Promise((r) => setTimeout(r, 1500)); s.write('Lab-pass-2026\r'); await wait(8000); }
  for (const c of cmds) { buf = ''; s.write(c + '\r'); await wait(c.includes('ping') ? 20000 : 8000); console.log('> ' + c + '\n' + buf.split('\n').slice(1).map((l) => l.trimEnd()).filter(Boolean).join('\n').slice(0, 1400) + '\n'); }
  s.destroy();
});
s.on('error', (e) => console.log('cannot connect: ' + e.message));
