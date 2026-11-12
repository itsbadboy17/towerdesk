// Create or change a TowerDesk login. Run in a terminal: npm run set-password
// The password is typed here (hidden) and stored only as a scrypt hash in data/auth.json.
const readline = require('readline');
const { setUser } = require('../src/auth');

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = function (s) {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write('*'.repeat(s.length ? 1 : 0));
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

(async () => {
  const username = (await ask('Username: ')).trim();
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    console.log('Username must be 3-32 characters: letters, numbers, . _ -');
    process.exit(1);
  }
  const password = await ask('Password (min 10 characters): ', true);
  if (password.length < 10) {
    console.log('Password is too short.');
    process.exit(1);
  }
  const again = await ask('Repeat password: ', true);
  if (again !== password) {
    console.log('Passwords do not match.');
    process.exit(1);
  }
  setUser(username, password);
  console.log(`Saved login for "${username}". Restart the server if it is running.`);
})();
