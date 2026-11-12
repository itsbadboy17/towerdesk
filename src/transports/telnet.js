// Telnet login check (common on ONUs and older gear). Answers option negotiation with
// "won't/don't", sends username/password at the prompts, and reports whether a shell prompt
// appeared. It runs no commands.
const net = require('net');
const { DEFAULT_TIMEOUT, friendlyError } = require('./common');

const IAC = 255, DONT = 254, DO = 253, WONT = 252, WILL = 251, SB = 250, SE = 240;

// Strip telnet negotiation from data and build refusals for any option requests.
function stripNegotiation(buf) {
  const text = [];
  const reply = [];
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== IAC) { text.push(buf[i]); continue; }
    const cmd = buf[i + 1];
    if (cmd === DO || cmd === DONT || cmd === WILL || cmd === WONT) {
      const opt = buf[i + 2];
      if (cmd === DO) reply.push(IAC, WONT, opt);
      if (cmd === WILL) reply.push(IAC, DONT, opt);
      i += 2;
    } else if (cmd === SB) {
      while (i < buf.length && !(buf[i] === IAC && buf[i + 1] === SE)) i++;
      i += 1;
    } else {
      i += 1;
    }
  }
  return { text: Buffer.from(text).toString('latin1'), reply: Buffer.from(reply) };
}

function test({ host, port = 23, username, password, timeout = DEFAULT_TIMEOUT }) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let screen = '';
    let stage = 'start';
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.destroy();
      resolve(res);
    };
    const banner = () => screen.replace(/\s+/g, ' ').trim().slice(0, 160);
    const timer = setTimeout(() => {
      if (stage === 'start' && screen) return finish({ ok: true, summary: 'Telnet open', details: { banner: banner() }, note: 'No login prompt seen' });
      finish({ ok: false, error: stage === 'sent-pass' ? 'No shell prompt after login' : friendlyError({ code: 'ETIMEDOUT' }) });
    }, timeout);

    sock.on('error', (err) => finish({ ok: false, error: friendlyError(err) }));
    sock.on('data', (d) => {
      const { text, reply } = stripNegotiation(d);
      if (reply.length) sock.write(reply);
      screen += text;
      const tail = screen.slice(-200);

      if (!username && !password) {
        if (/(login|username|user name|password)\s*:\s*$/i.test(tail) || screen.length > 40) {
          finish({ ok: true, summary: 'Telnet reachable (login not attempted)', details: { banner: banner() } });
        }
        return;
      }
      if (/(incorrect|invalid|failed|denied|bad password|error)/i.test(tail) && stage === 'sent-pass') {
        return finish({ ok: false, error: 'Wrong username or password' });
      }
      if (stage === 'start' && /(login|username|user name)\s*:\s*$/i.test(tail)) {
        sock.write((username || '') + '\r\n');
        stage = 'sent-user';
        screen = '';
      } else if ((stage === 'start' || stage === 'sent-user') && /password\s*:\s*$/i.test(tail)) {
        sock.write((password || '') + '\r\n');
        stage = 'sent-pass';
        screen = '';
      } else if (stage === 'sent-pass' && /[#>$%]\s*$/.test(tail)) {
        const prompt = tail.trim().split(/\r?\n/).pop();
        finish({ ok: true, summary: 'Telnet login OK', details: { prompt: prompt.slice(-60) } });
      } else if (stage === 'sent-user' && /(login|username)\s*:\s*$/i.test(tail)) {
        finish({ ok: false, error: 'Wrong username or password' });
      }
    });
  });
}

module.exports = { test, stripNegotiation };
