// Network scan: find the devices in a private IP range (up to 256 addresses, e.g. a /24) and
// identify each one with transports.detect(). Read-only: it pings, opens TCP connections to
// management ports, reads web login pages and asks SNMP for the system description.
// It never logs in. The SNMP community is kept in memory for the scan only and is never returned.
const crypto = require('crypto');
const { ping, tcpProbe } = require('./transports/common');
const transports = require('./transports');
const devices = require('./devices');

const MAX_HOSTS = 256;
const CONCURRENCY = 32; // gentle enough for a wireless backhaul
const LIVE_PORTS = [80, 443, 22, 8291, 8728, 23];

function ipToInt(ip) {
  const m = String(ip).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function intToIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

// Private (RFC 1918), carrier-grade NAT (RFC 6598, common on tower networks) and loopback.
function isPrivate(n) {
  const a = n >>> 24, b = (n >>> 16) & 255;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a === 127;
}

// "10.0.0.0/24", "10.0.0.1-50", "10.0.0.1-10.0.0.50" or one address -> list of addresses.
function parseRange(input) {
  const s = String(input || '').trim().replace(/\s+/g, '');
  if (!s) throw new Error('Enter an IP range, for example 192.168.1.0/24');
  let start, end;
  let m;
  if ((m = s.match(/^([\d.]+)\/(\d{1,2})$/))) {
    const base = ipToInt(m[1]);
    const prefix = Number(m[2]);
    if (base === null) throw new Error('Invalid IP address in the range');
    if (prefix < 24 || prefix > 32) throw new Error('Use a range of /24 or smaller (at most 256 addresses)');
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    start = (base & mask) >>> 0;
    end = (start + 2 ** (32 - prefix) - 1) >>> 0;
    if (prefix <= 30) { start += 1; end -= 1; } // skip the network and broadcast addresses
  } else if ((m = s.match(/^([\d.]+)-([\d.]+)$/))) {
    start = ipToInt(m[1]);
    if (start === null) throw new Error('Invalid IP address in the range');
    end = /^\d{1,3}$/.test(m[2]) ? ((start & 0xffffff00) >>> 0) + Number(m[2]) : ipToInt(m[2]);
    if (end === null || Number(m[2]) > 255 && /^\d+$/.test(m[2])) throw new Error('Invalid end of the range');
    if (end < start) throw new Error('The end of the range is before the start');
  } else {
    start = end = ipToInt(s);
    if (start === null) throw new Error('Enter an IP range like 192.168.1.0/24 or 192.168.1.1-254');
  }
  if (end - start + 1 > MAX_HOSTS) throw new Error('At most 256 addresses per scan (a /24)');
  if (!isPrivate(start) || !isPrivate(end)) throw new Error('Only private ranges can be scanned (10.x, 172.16-31.x, 192.168.x, 100.64-127.x)');
  const list = [];
  const single = start === end;
  for (let n = start; n <= end; n++) {
    // In a range scan, skip the .1 host — it's the network gateway, not tower equipment.
    // (Scanning a single ".1" address on purpose still works.)
    if (!single && (n & 255) === 1) continue;
    list.push(intToIp(n));
  }
  return list;
}

// Quick "is anything there?" check before the slower identification.
async function isLive(ip) {
  const checks = [ping(ip, { timeout: 1000 }).then((p) => p.alive)]
    .concat(LIVE_PORTS.map((port) => tcpProbe(ip, port, { timeout: 1500 }).then((t) => t.open)));
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

// A web-page <title> like "404 Not Found" or "401 Unauthorized" names an error page, not the
// device, so it must not become the device's name.
function usableTitle(t) {
  if (!t) return '';
  return /\b(400|401|403|404|500|502|503|not\s*found|forbidden|unauthoriz|bad\s*request|error|page\s*not)\b/i.test(t) ? '' : t;
}

function describe(ip, d) {
  const services = Object.keys(d.openPorts || {}).map((k) => k + ' (' + d.openPorts[k].port + ')');
  if (d.snmp) services.push('snmp (161)');
  return {
    ip,
    vendor: d.vendor || null,
    suggestedMethod: d.suggestedMethod || null,
    name: (d.snmp && d.snmp.name) || (d.web && d.web.model) || usableTitle(d.web && d.web.title) || '',
    model: (d.web && d.web.model) || undefined,
    firmware: (d.web && d.web.firmware) || undefined,
    description: d.snmp && d.snmp.description ? String(d.snmp.description).slice(0, 160) : undefined,
    services,
    pingMs: d.ping && d.ping.alive ? d.ping.ms : null
  };
}

const jobs = new Map();
let running = null;

function publicJob(job) {
  const existing = devices.list();
  return {
    id: job.id,
    range: job.range,
    status: job.status,
    total: job.total,
    scanned: job.scanned,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    found: job.found
      .slice()
      .sort((a, b) => ipToInt(a.ip) - ipToInt(b.ip))
      .map((f) => {
        const e = existing.find((x) => x.ip === f.ip);
        return { ...f, existing: e ? e.name : null };
      })
  };
}

function start({ range, community }) {
  if (running && running.status === 'running') {
    const err = new Error('A scan is already running. Wait for it to finish or stop it.');
    err.status = 409;
    throw err;
  }
  const hosts = parseRange(range);
  const job = {
    id: 'scan-' + crypto.randomBytes(5).toString('hex'),
    range: String(range).trim(),
    status: 'running',
    total: hosts.length,
    scanned: 0,
    found: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    cancelled: false
  };
  jobs.set(job.id, job);
  if (jobs.size > 5) jobs.delete(jobs.keys().next().value);
  running = job;

  const queue = hosts.slice();
  const worker = async () => {
    while (queue.length && !job.cancelled) {
      const ip = queue.shift();
      try {
        if (await isLive(ip)) {
          const d = await transports.detect(ip, { community });
          if (d.ok) job.found.push(describe(ip, d));
        }
      } catch (e) { /* one bad host must not stop the scan */ }
      job.scanned++;
    }
  };
  Promise.all(Array.from({ length: Math.min(CONCURRENCY, hosts.length) }, worker)).then(() => {
    job.status = job.cancelled ? 'stopped' : 'done';
    job.finishedAt = new Date().toISOString();
  });
  return publicJob(job);
}

function get(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

function stop(id) {
  const job = jobs.get(id);
  if (!job) return null;
  job.cancelled = true;
  return publicJob(job);
}

module.exports = { MAX_HOSTS, parseRange, start, get, stop };
