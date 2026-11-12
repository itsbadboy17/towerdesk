// Shared helpers for device transports. Nothing here logs or returns credentials.
const net = require('net');
const { spawn } = require('child_process');

const DEFAULT_TIMEOUT = 6000;

function isValidHost(host) {
  return typeof host === 'string' && host.length <= 253 && /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host);
}

function toPort(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : fallback;
}

// Turn socket/library errors into short, human messages.
function friendlyError(err) {
  const code = err && (err.code || err.level);
  const map = {
    ECONNREFUSED: 'Connection refused (port closed or service disabled)',
    ETIMEDOUT: 'Timed out (device unreachable or port filtered)',
    TIMEOUT: 'Timed out (device unreachable or port filtered)',
    EHOSTUNREACH: 'Host unreachable (check IP, VPN or routing)',
    ENETUNREACH: 'Network unreachable (check VPN or routing)',
    ENOTFOUND: 'Host name not found',
    ECONNRESET: 'Connection reset by device',
    'client-authentication': 'Wrong username or password',
    RequestTimedOutError: 'No SNMP reply (wrong community, SNMP disabled, or unreachable)'
  };
  if (code && map[code]) return map[code];
  if (err && err.name && map[err.name]) return map[err.name];
  return (err && err.message) ? String(err.message).slice(0, 200) : 'Unknown error';
}

// Open a TCP connection and optionally read the first bytes the server sends.
function tcpProbe(host, port, { timeout = 3000, readBanner = false } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const sock = net.connect({ host, port });
    let banner = '';
    let done = false;
    let connectedMs = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(result);
    };
    // Connected but silent (e.g. HTTP waits for a request) still counts as open.
    sock.setTimeout(timeout, () => finish(connectedMs !== null
      ? { open: true, ms: connectedMs, banner: banner.trim() }
      : { open: false, error: friendlyError({ code: 'ETIMEDOUT' }) }));
    sock.on('connect', () => {
      connectedMs = Date.now() - started;
      if (!readBanner) finish({ open: true, ms: connectedMs });
    });
    sock.on('data', (d) => {
      banner += d.toString('latin1');
      if (banner.includes('\n') || banner.length > 512) finish({ open: true, ms: Date.now() - started, banner: banner.slice(0, 512).trim() });
    });
    sock.on('error', (err) => finish({ open: false, error: friendlyError(err) }));
  });
}

// ICMP ping via the OS ping command (no raw sockets needed).
function ping(host, { timeout = 2000 } = {}) {
  return new Promise((resolve) => {
    if (!isValidHost(host)) return resolve({ alive: false, error: 'Invalid host' });
    const win = process.platform === 'win32';
    const args = win ? ['-n', '1', '-w', String(timeout), host] : ['-c', '1', '-W', String(Math.ceil(timeout / 1000)), host];
    let out = '';
    const p = spawn('ping', args, { windowsHide: true });
    p.stdout.on('data', (d) => { out += d.toString(); });
    p.on('error', () => resolve({ alive: false, error: 'ping command not available' }));
    p.on('close', () => {
      const alive = /ttl[=:]/i.test(out);
      const m = out.match(/time[=<]\s*([\d.]+)\s*ms/i);
      resolve({ alive, ms: m ? Number(m[1]) : null });
    });
  });
}

module.exports = { DEFAULT_TIMEOUT, isValidHost, toPort, friendlyError, tcpProbe, ping };
