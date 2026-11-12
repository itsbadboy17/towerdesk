// SSH login check using the pure-JS ssh2 client. Authenticates (password or keyboard-interactive)
// and disconnects without running any command.
const { Client } = require('ssh2');
const { DEFAULT_TIMEOUT, friendlyError } = require('./common');

function vendorFromIdent(ident) {
  if (/ROSSSH/i.test(ident)) return 'mikrotik';
  if (/Cisco/i.test(ident)) return 'cisco';
  if (/dropbear/i.test(ident)) return null; // used by many vendors (UBNT, ONUs, TP-Link)
  return null;
}

function test({ host, port = 22, username, password, timeout = DEFAULT_TIMEOUT }) {
  return new Promise((resolve) => {
    const conn = new Client();
    let ident = '';
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      conn.end();
      resolve(res);
    };
    conn.on('handshake', () => {
      // ssh2 exposes the server's identification string after the handshake.
      ident = (conn._remoteVer || '').toString();
    });
    conn.on('ready', () => finish({
      ok: true,
      vendor: vendorFromIdent(ident) || undefined,
      summary: 'SSH login OK' + (ident ? ` (${ident})` : ''),
      details: { server: ident || undefined }
    }));
    conn.on('keyboard-interactive', (name, instr, lang, prompts, reply) => reply(prompts.map(() => password || '')));
    conn.on('error', (err) => finish({ ok: false, error: friendlyError(err) }));
    try {
      conn.connect({
        host,
        port,
        username: username || 'admin',
        password: password || '',
        tryKeyboard: true,
        readyTimeout: timeout,
        // Network gear often only offers older algorithms; allow them for compatibility.
        algorithms: {
          kex: { append: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'] },
          serverHostKey: { append: ['ssh-rsa', 'ssh-dss'] },
          cipher: { append: ['aes128-cbc', 'aes256-cbc', '3des-cbc'] }
        }
      });
    } catch (err) {
      finish({ ok: false, error: friendlyError(err) });
    }
  });
}

module.exports = { test, vendorFromIdent };
