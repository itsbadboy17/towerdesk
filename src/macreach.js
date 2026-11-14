// "Reach it by MAC": give a brand-new MikroTik an address through another MikroTik that sees it.
//   look  - READ-ONLY. Asks the relay router (over the API) what it sees next to it, so the new router is picked from a list.
//   plan  - READ-ONLY. Checks the relay router, asks it (over the API) whether it can see that MAC, and shows the exact
//           commands. Nothing is typed on any router.
//   apply - only when an admin has switched writing on (the same switch as "Set up a device"). Types the commands, then
//           checks the new router answers on its API at the new address. If it does not, the address TowerDesk added is
//           removed again.
// Passwords (the relay's saved login, the new router's factory login and the new password) are used in memory for this
// one request. They are not stored, logged or put in any message.
const devices = require('./devices');
const mikrotik = require('./transports/mikrotik');
const macDriver = require('./transports/mikrotik-mac');
const neighbors = require('./neighbors');
const provision = require('./provision');
const model = require('../public/macreach-model.js');

let drivers = { openApi: (o) => mikrotik.Session.open(o), openShell: macDriver.openRelayShell, run: macDriver.run, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

function relayOf(id) {
  const d = devices.get(String(id || ''));
  if (!d) throw new Error('Choose the MikroTik that will act as the relay.');
  if (!/^mikrotik/.test(String(d.method || ''))) throw new Error('The relay must be a MikroTik that TowerDesk already connects to with the MikroTik API.');
  return d;
}

// A read-only look at the relay through its API: its neighbour, ARP and MAC tables. Nothing is typed on it.
async function readRelay(relay) {
  const o = devices.connectionOptions(relay);
  try {
    const session = await drivers.openApi({ host: o.host, port: o.port || undefined, username: o.username, password: o.password, secure: relay.method === 'mikrotik-ssl' });
    try { return neighbors.fromMikrotikTables(await mikrotik.readNeighborTables(session)); } finally { session.close(); }
  } catch (e) { throw new Error('Could not read the relay router (' + String((e && e.message) || 'error').slice(0, 80) + ').'); }
}

// What the relay sees next to it right now: the list the new router is chosen from, so nobody has to find and type a
// MAC address. READ-ONLY. macsById: the MACs the monitor already read per device, so a neighbour that is already in
// TowerDesk is marked as such (by its address or its MAC, never by its name: every new MikroTik is called "MikroTik").
async function look(body, macsById) {
  const relay = relayOf(body && body.relayId);
  const t = await readRelay(relay);
  const obs = neighbors.observations().filter((o) => o.deviceId !== relay.id).concat([Object.assign({ deviceId: relay.id }, t)]);
  const ix = neighbors.ownerIndex(devices.list(), obs, macsById);
  const rows = t.rows.filter((r) => r.mac && !t.selfMacs.includes(r.mac)).map((r) => {
    const d = (r.ip && ix.byIp[r.ip]) || ix.byId[ix.macOwner[r.mac]] || null;
    return { mac: r.mac, name: r.name, model: r.board || r.platform, version: r.version, ip: r.ip, port: r.localPort, farPort: r.remotePort,
      mikrotik: neighbors.typeHint(r.platform) === 'mikrotik', knownAs: d ? d.name : '', self: !!d && d.id === relay.id };
  }).filter((r) => !r.self);
  return { ok: true, relay: { id: relay.id, name: relay.name, ip: relay.ip }, found: model.candidates(rows) };
}

async function plan(body) {
  body = body || {};
  const v = model.validate(body);
  if (!v.ok) return { ok: false, errors: v.errors };
  const relay = relayOf(body.relayId);
  // Does the relay see that MAC on its wires, and is the new address already taken?
  const t = await readRelay(relay);
  const want = neighbors.normMac(v.clean.mac);
  const row = t.rows.find((r) => r.mac === want);
  const seen = row ? { interface: row.localPort, identity: row.name, platform: row.platform, ip: row.ip } : false;
  let conflict = t.arp.some((a) => a.ip === v.clean.ip && a.mac !== want) ? 'Another device already answers at ' + v.clean.ip + '.' : null;
  const mine = devices.list().find((d) => d.ip === v.clean.ip);
  if (mine) conflict = conflict || 'TowerDesk already has a device at ' + v.clean.ip + ' (' + mine.name + ').';
  const writeOn = provision.settings().allowWrite;
  return {
    ok: true, relay: { id: relay.id, name: relay.name, ip: relay.ip }, seen, conflict, writeOn,
    commands: model.script(v.clean).map((l) => ({ cmd: model.maskLine(l), why: l.why })),
    revert: model.revertScript(v.clean),
    canApply: writeOn && !conflict && seen !== false,
    notes: [
      'TowerDesk will log in to ' + relay.name + ' over SSH (port ' + (relay.sshPort || 22) + ') with its saved login. SSH must be switched on there (IP, Services).',
      'The new router must be on the same switch or VLAN as ' + relay.name + '.'
    ].concat(seen === false ? ['The relay does not see that MAC address right now. Plug the router into the switch, wait a few seconds, and preview again.'] : [])
  };
}

async function verify(c) {
  // The new router may need a moment to apply the address and start the API.
  const pass = c.newPassword !== undefined ? c.newPassword : c.factoryPass;
  let last;
  for (let i = 0; i < 4; i++) {
    await drivers.sleep(i === 0 ? 1500 : 2500);
    try {
      const s = await drivers.openApi({ host: c.ip, username: c.factoryUser, password: pass });
      try { const id = await s.run(['/system/identity/print']); return { ok: true, identity: (id[0] || {}).name || '' }; } finally { s.close(); }
    } catch (e) { last = e; }
  }
  return { ok: false, error: String((last && last.message) || 'no answer').slice(0, 80) };
}

// Take back what TowerDesk added (the address, route and firewall rule carry its comment). The router may or may not
// have taken the new password yet, so the factory password is tried first and then the new one.
async function revert(c, shellOpts, base) {
  const passes = [c.factoryPass].concat(c.newPassword ? [c.newPassword] : []);
  for (const pass of passes) {
    let shell;
    try {
      shell = await drivers.openShell(shellOpts);
      await drivers.run(shell, Object.assign({}, base, { pass, newPassword: undefined, lines: model.revertScript(c).map((cmd) => ({ cmd })) }));
      return true;
    } catch (e) { /* try the next password */ } finally { try { shell && shell.end(); } catch (x) { /* closed */ } }
  }
  return false;
}

async function apply(body) {
  if (!provision.settings().allowWrite) throw new Error('Writing to routers is switched off. An admin can switch it on in Settings (Device setup) once you are ready to try it on a spare router.');
  body = body || {};
  const v = model.validate(body);
  if (!v.ok) throw new Error('Some of the values are not valid. Run the preview again.');
  const c = v.clean;
  const relay = relayOf(body.relayId);
  const o = devices.connectionOptions(relay);
  if (devices.list().some((d) => d.ip === c.ip)) throw new Error('TowerDesk already has a device at ' + c.ip + '.');
  const shellOpts = { host: o.host, port: Number(relay.sshPort) || 22, username: o.username, password: o.password };
  const base = { mac: c.mac, user: c.factoryUser, pass: c.factoryPass, newPassword: c.newPassword };
  let shell = await drivers.openShell(shellOpts);
  let result;
  try {
    result = await drivers.run(shell, Object.assign({ lines: model.script(c) }, base));
  } catch (e) {
    try { shell.end(); } catch (x) { /* closed */ }
    // The router may have taken some commands before it stopped. Try to take back what TowerDesk added.
    const undone = e && e.kind === 'command' ? await revert(c, shellOpts, base) : false;
    throw new Error(String(e.message || 'The setup stopped.').slice(0, 260) + (e && e.kind === 'command' ? (undone ? ' TowerDesk took back the address it had added.' : ' TowerDesk could not take back what it had added: check the router.') : ''));
  }
  try { shell.end(); } catch (e) { /* closed */ }
  const check = await verify(c);
  if (check.ok) return { ok: true, verified: true, ip: c.ip, identity: check.identity, name: c.name || check.identity, sent: result.sent };
  // Not reachable at the new address: take the address back so nothing half-done is left.
  const undone = await revert(c, shellOpts, base);
  throw new Error('The commands were typed, but TowerDesk cannot reach the router at ' + c.ip + ' (' + check.error + '). ' + (undone ? 'The address was removed again.' : 'TowerDesk could not remove the address: check the router.') + ' If the router has the default firewall, add an API rule for your management network and try again.');
}

module.exports = { look, plan, apply, _use: (d) => { drivers = Object.assign({}, drivers, d); } };
