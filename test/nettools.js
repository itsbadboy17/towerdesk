// Ping and traceroute output parsing (public/nettools-model.js), with real samples from Windows
// and Linux, including lost packets and silent hops.
const m = require('../public/nettools-model.js');

let failed = 0;
function ok(name, cond) { console.log((cond ? 'pass  ' : 'FAIL  ') + name); if (!cond) failed++; }

const winPing = `
Pinging 10.118.82.13 with 32 bytes of data:
Reply from 10.118.82.13: bytes=32 time=4ms TTL=57
Request timed out.
Reply from 10.118.82.13: bytes=32 time=3ms TTL=57
Request timed out.

Ping statistics for 10.118.82.13:
    Packets: Sent = 4, Received = 2, Lost = 2 (50% loss),
Approximate round trip times in milli-seconds:
    Minimum = 3ms, Maximum = 4ms, Average = 3ms
`;
let p = m.parsePing(winPing);
ok('windows ping: counts', p.sent === 4 && p.received === 2 && p.lost === 2 && p.lossPct === 50);
ok('windows ping: each packet has a place, in order', p.replies.map((r) => (r.ok ? r.ms : 'x')).join() === '4,x,3,x');
ok('windows ping: min, average, max', p.minMs === 3 && p.maxMs === 4 && p.avgMs === 3.5);
ok('half the packets lost is an unstable link', m.pingVerdict(p).tone === 'warn' && /50%/.test(m.pingVerdict(p).text) && /unstable/.test(m.pingVerdict(p).text));

p = m.parsePing('Reply from 10.0.0.1: bytes=32 time<1ms TTL=64\nReply from 10.0.0.1: bytes=32 time=1ms TTL=64\nReply from 10.0.0.1: bytes=32 time=2ms TTL=64\nReply from 10.0.0.1: bytes=32 time=1ms TTL=64\nPackets: Sent = 4, Received = 4, Lost = 0 (0% loss)');
ok('a time under 1 ms is counted, all fine', p.received === 4 && p.lossPct === 0 && p.replies[0].ms === 0.5 && m.pingVerdict(p).tone === 'good');

p = m.parsePing('Request timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\nPackets: Sent = 4, Received = 0, Lost = 4 (100% loss),');
ok('no reply at all says so', p.received === 0 && m.pingVerdict(p).tone === 'bad' && /No reply at all/.test(m.pingVerdict(p).text) && p.avgMs === null);

p = m.parsePing('Reply from 10.0.0.9: bytes=32 time=420ms TTL=60\nReply from 10.0.0.9: bytes=32 time=380ms TTL=60\nPackets: Sent = 2, Received = 2, Lost = 0 (0% loss)');
ok('slow but complete is a warning about speed', m.pingVerdict(p).tone === 'warn' && /slowly/.test(m.pingVerdict(p).text));

p = m.parsePing('Reply from 10.0.0.2: Destination host unreachable.\nReply from 10.0.0.2: Destination host unreachable.\nPackets: Sent = 2, Received = 2, Lost = 0 (0% loss)');
ok('"destination unreachable" is not counted as an answer from the device', p.replies.every((r) => !r.ok));

const linuxPing = `PING 10.0.0.5 (10.0.0.5) 56(84) bytes of data.
64 bytes from 10.0.0.5: icmp_seq=1 ttl=57 time=3.21 ms
64 bytes from 10.0.0.5: icmp_seq=3 ttl=57 time=4.50 ms

--- 10.0.0.5 ping statistics ---
4 packets transmitted, 2 received, 50% packet loss, time 3004ms
rtt min/avg/max/mdev = 3.210/3.855/4.500/0.645 ms`;
p = m.parsePing(linuxPing);
ok('linux ping: lost packets are filled in from the totals', p.sent === 4 && p.received === 2 && p.replies.length === 4 && p.replies.filter((r) => r.ok).length === 2 && p.avgMs === 3.9);

ok('an unknown host is reported plainly', /could not be found/.test(m.parsePing('Ping request could not find host nope. Please check the name and try again.').error));
ok('empty output is an error, not a crash', !!m.parsePing('').error);

const winTrace = `
Tracing route to 10.118.82.13 over a maximum of 15 hops

  1     1 ms     1 ms    <1 ms  192.168.0.1
  2     *        *        *     Request timed out.
  3    11 ms     9 ms    12 ms  10.118.82.1
  4     4 ms     3 ms     3 ms  10.118.82.13

Trace complete.
`;
let t = m.parseTrace(winTrace, '10.118.82.13');
ok('windows trace: four steps with their address', t.hops.length === 4 && t.hops[0].host === '192.168.0.1' && t.hops[3].host === '10.118.82.13');
ok('windows trace: the silent step is marked, not dropped', t.hops[1].silent === true && t.hops[1].host === null && t.hops[1].times.length === 3);
ok('windows trace: average per step, and "<1 ms" counts', t.hops[2].avgMs === 10.7 && t.hops[0].times[2] === 0.5);
ok('reaching the destination is a good verdict', t.reached === true && m.traceVerdict(t).tone === 'good' && /4 steps/.test(m.traceVerdict(t).text));

t = m.parseTrace(`Tracing route to 10.118.82.13 over a maximum of 15 hops

  1     1 ms     1 ms     1 ms  192.168.0.1
  2     5 ms     4 ms     5 ms  10.118.82.1
  3     *        *        *     Request timed out.
  4     *        *        *     Request timed out.
`, '10.118.82.13');
ok('stopping short names the last router that answered', t.reached === false && m.traceVerdict(t).tone === 'warn' && /10\.118\.82\.1 \(step 2\)/.test(m.traceVerdict(t).text));

t = m.parseTrace(` 1  192.168.0.1  1.234 ms  1.1 ms  1.0 ms\n 2  * * *\n 3  10.9.9.9  8.2 ms  8.0 ms  8.1 ms`, '10.9.9.9');
ok('linux traceroute lines read the same way', t.hops.length === 3 && t.hops[0].host === '192.168.0.1' && t.hops[0].times.length === 3 && t.hops[1].silent && t.reached === true);
ok('nothing back from trace is explained', m.traceVerdict(m.parseTrace('', 'x')).tone === 'bad');

if (failed) { console.log(failed + ' nettools test(s) failed.'); process.exit(1); }
console.log('Nettools tests passed.');
