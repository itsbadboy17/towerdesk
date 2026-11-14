// Stand-in for the Claude Code program, used by test/advisor.js. What it does is chosen with
// FAKE_MODE; every call is logged to FAKE_LOG (arguments, what it was sent, where it ran).
const fs = require('fs');

const args = process.argv.slice(2);
let stdin = '';
process.stdin.on('data', (d) => { stdin += d; });
process.stdin.on('end', () => {
  if (process.env.FAKE_LOG) {
    fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args, stdin, cwd: process.cwd(), keyInEnv: !!process.env.ANTHROPIC_API_KEY }) + '\n');
  }
  const out = (o) => process.stdout.write(JSON.stringify(o));
  if (args[0] === 'auth' && args[1] === 'status') { out({ loggedIn: process.env.FAKE_LOGGED !== '0' }); return; }
  const advice = {
    summary: 'One channel overlaps your other radio.', causes: ['Overlap with radio A.'], manual: ['Realign client 1.'], confidence: 'medium',
    changes: [{ setting: 'frequency', to: 5260, reason: 'Clears radio A.', risk: 'Clients reconnect.' }]
  };
  const mode = process.env.FAKE_MODE || 'structured';
  if (mode === 'structured') out({ is_error: false, result: '', structured_output: advice });
  else if (mode === 'fenced') out({ is_error: false, result: '```json\n' + JSON.stringify(advice) + '\n```' });
  else if (mode === 'notlogged') { out({ is_error: true, result: 'Not logged in · Please run /login' }); process.exitCode = 1; }
  else if (mode === 'apierror') { out({ is_error: true, result: 'Overloaded, try later' }); process.exitCode = 1; }
  else if (mode === 'garbage') out({ is_error: false, result: 'Sorry, I cannot help with that.' });
  else if (mode === 'nojson') process.stdout.write('boom');
  else if (mode === 'hang') setTimeout(() => {}, 60000);
});
