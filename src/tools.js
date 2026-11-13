// Network tools run from the TowerDesk machine: ping and traceroute to a device or customer IP.
// The host is validated with the same rule as device addresses and passed as a single argument
// to the system command (no shell), so nothing typed in the UI can run anything else.
const { execFile } = require('child_process');
const { isValidHost } = require('./transports/common');

const WIN = process.platform === 'win32';
const COMMANDS = {
  ping: () => (WIN ? ['ping', ['-n', '4', '-w', '1500']] : ['ping', ['-c', '4', '-W', '2']]),
  trace: () => (WIN ? ['tracert', ['-d', '-h', '15', '-w', '800']] : ['traceroute', ['-n', '-m', '15', '-w', '1']])
};

// Resolves { ok, tool, host, output } — never rejects; a failed ping is a normal result.
function run(tool, host) {
  return new Promise((resolve) => {
    host = String(host || '').trim();
    if (!COMMANDS[tool]) return resolve({ ok: false, error: 'Unknown tool' });
    if (!isValidHost(host)) return resolve({ ok: false, error: 'Invalid IP address or host name' });
    const [cmd, args] = COMMANDS[tool]();
    execFile(cmd, args.concat(host), { timeout: tool === 'trace' ? 60000 : 20000, windowsHide: true, maxBuffer: 256 * 1024 }, (err, stdout, stderr) => {
      const output = String(stdout || '').trim() || String(stderr || '').trim();
      if (err && !output) return resolve({ ok: false, tool, host, error: err.code === 'ENOENT' ? cmd + ' is not available on this computer' : 'The command did not finish' });
      resolve({ ok: !err, tool, host, output: output.slice(0, 8000) });
    });
  });
}

module.exports = { run };
