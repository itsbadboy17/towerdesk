// Who is next to whom. Read-only: it only reads the neighbour tables that managed devices already keep
// (MikroTik neighbour discovery, LLDP, CDP, the ARP and MAC tables) and compares them with the devices
// TowerDesk knows. Nothing is ever written to a device. The result is a set of SUGGESTIONS for the
// link diagram ("gets its internet from"); the owner decides.
const fs = require('fs');
const path = require('path');
const { dataDir } = require('./paths');

const FILE = path.join(dataDir(), 'neighbors.json');

// ---------------- tiny helpers ----------------
function normMac(v) {
  if (Buffer.isBuffer(v)) v = v.length === 6 ? v.toString('hex') : v.toString('latin1');
  const h = String(v || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  return h.length === 12 ? h.replace(/(..)(?!$)/g, '$1:') : '';
}
function normIp(v) {
  const s = String(v || '').trim();
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s !== '0.0.0.0' ? s : '';
}
function nameKey(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function clean(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n || 120); }

// 'switch' for things that forward traffic for others; '' when we cannot tell.
function kindOf(platform, name) {
  if (/cisco|catalyst|ws-c|switch|procurve|aruba|juniper|netgear|dgs-|sg\d{3}/i.test(String(platform || '')) || /^(switch|sw[-_ ]?\d)/i.test(String(name || ''))) return 'switch';
  return '';
}
// Which TowerDesk brand to preselect when adding something that was only seen on the network.
function typeHint(platform) {
  const p = String(platform || '');
  if (/cisco|catalyst|ws-c/i.test(p)) return 'cisco';
  if (/mikrotik|routeros/i.test(p)) return 'mikrotik';
  if (/ubiquiti|ubnt|airos/i.test(p)) return 'ubnt';
  if (/mimosa/i.test(p)) return 'mimosa';
  return 'other';
}

// ---------------- raw tables -> one list of neighbour rows ----------------
// A row: { via: 'mndp'|'lldp'|'cdp'|'api', mac, ip, name, platform, remotePort, localPort }
function fromSnmpTables(t) {
  t = t || {};
  const rows = [];
  (t.mndp || []).forEach((r) => rows.push({ via: 'mndp', mac: normMac(r.mac), ip: normIp(r.ip), name: clean(r.identity, 80), platform: clean(r.platform, 80), remotePort: '', localPort: ifName(t, r.ifIndex) }));
  (t.lldp || []).forEach((r) => rows.push({ via: 'lldp', mac: normMac(r.chassis), ip: '', name: clean(r.sysName, 80), platform: '', remotePort: clean(r.portId || r.portDesc, 60), localPort: ifName(t, r.local) }));
  (t.cdp || []).forEach((r) => rows.push({ via: 'cdp', mac: '', ip: normIp(r.addr), name: clean(r.deviceId, 80), platform: clean(r.platform, 80), remotePort: clean(r.port, 60), localPort: ifName(t, r.ifIndex) }));
  return finishRows(rows, t);
}
function ifName(t, idx) { return idx == null ? '' : clean((t.ifNames || {})[idx] || 'if' + idx, 40); }

function fromMikrotikTables(t) {
  t = t || {};
  const rows = (t.neighbors || []).map((r) => ({
    via: 'mndp', mac: normMac(r['mac-address']), ip: normIp(r.address || r.address4), name: clean(r.identity, 80), platform: clean(r.platform || r.board, 80),
    remotePort: '', localPort: clean(String(r.interface || '').split(',')[0], 40)
  }));
  return finishRows(rows, {
    arp: (t.arp || []).map((a) => ({ ip: a.address, mac: a['mac-address'] })),
    fdb: (t.hosts || []).map((h) => ({ mac: h['mac-address'], port: h['on-interface'] })),
    gateway: t.gateway, selfMacs: t.selfMacs
  });
}

// The same neighbour often shows up twice (LLDP and MNDP): merge by MAC, then by IP.
function finishRows(rows, t) {
  const out = [];
  rows.forEach((r) => {
    if (!r.mac && !r.ip && !r.name) return;
    const hit = out.find((o) => (r.mac && o.mac === r.mac) || (r.ip && o.ip === r.ip));
    if (!hit) { out.push(Object.assign({}, r)); return; }
    ['mac', 'ip', 'name', 'platform', 'remotePort', 'localPort'].forEach((k) => { if (!hit[k] && r[k]) hit[k] = r[k]; });
    hit.via = hit.via === r.via ? hit.via : hit.via + '+' + r.via;
  });
  return {
    rows: out,
    gateway: normIp(t.gateway),
    arp: (t.arp || []).map((a) => ({ ip: normIp(a.ip), mac: normMac(a.mac) })).filter((a) => a.ip && a.mac),
    fdb: (t.fdb || []).map((f) => ({ mac: normMac(f.mac), port: clean(f.port, 40) })).filter((f) => f.mac).slice(0, 1024),
    selfMacs: (t.selfMacs || []).map(normMac).filter(Boolean)
  };
}

// ---------------- analysis ----------------
// devices: [{id, name, ip, type, parentId}], observations: [{deviceId, rows, gateway, arp, fdb, selfMacs}],
// macsById: { deviceId: [mac...] } (own MACs the monitor already read, e.g. from airOS).
function analyse(devices, observations, macsById) {
  devices = devices || []; observations = observations || []; macsById = macsById || {};
  const byId = {}; devices.forEach((d) => { byId[d.id] = d; });
  const byIp = {}; devices.forEach((d) => { if (normIp(d.ip)) byIp[normIp(d.ip)] = d; });
  const macOwner = {}; // mac -> device id
  const macIp = {};    // mac -> ip (learnt from rows and ARP)
  const addMac = (id, m) => { m = normMac(m); if (m && id) macOwner[m] = id; };
  Object.keys(macsById).forEach((id) => (macsById[id] || []).forEach((m) => addMac(id, m)));
  observations.forEach((o) => {
    (o.selfMacs || []).forEach((m) => addMac(o.deviceId, m));
    (o.arp || []).forEach((a) => { if (a.mac && a.ip) macIp[a.mac] = a.ip; });
    (o.rows || []).forEach((r) => { if (r.mac && r.ip) macIp[r.mac] = r.ip; });
  });
  Object.keys(macIp).forEach((m) => { if (!macOwner[m] && byIp[macIp[m]]) macOwner[m] = byIp[macIp[m]].id; });

  // One entity per box: a known device, or something only seen on the network.
  const unknown = {};
  function entityFor(r) {
    let d = (r.ip && byIp[r.ip]) || (r.mac && macOwner[r.mac] && byId[macOwner[r.mac]]);
    if (!d && r.name) d = devices.find((x) => nameKey(x.name) === nameKey(r.name));
    if (d) return { key: d.id, id: d.id, name: d.name, ip: d.ip, known: true };
    const key = r.mac ? 'mac:' + r.mac : r.ip ? 'ip:' + r.ip : 'name:' + nameKey(r.name);
    const u = unknown[key] || (unknown[key] = { key, id: null, name: r.name || r.ip || r.mac, ip: r.ip || macIp[r.mac] || '', mac: r.mac || '', platform: r.platform || '', known: false, seenBy: [], via: r.via });
    if (r.platform && !u.platform) u.platform = r.platform;
    if (r.name && (!u.name || u.name === u.ip || u.name === u.mac)) u.name = r.name;
    return u;
  }
  const entityOfId = (id) => ({ key: id, id, name: byId[id] ? byId[id].name : id, ip: byId[id] ? byId[id].ip : '', known: true });

  // groups[`${collector}|${port}`] = { collector, port, members: Map(key -> {entity, via, remotePort}) }
  const groups = {};
  const grp = (c, port) => groups[c + '|' + port] || (groups[c + '|' + port] = { collector: c, port: port || '', members: new Map() });
  let gateway = '';
  observations.forEach((o) => {
    if (!byId[o.deviceId]) return;
    gateway = gateway || normIp(o.gateway);
    const seenDirect = new Set(); // what this device saw in its neighbour table beats its MAC table
    (o.rows || []).forEach((r) => {
      const e = entityFor(r);
      if (e.id === o.deviceId) return;
      seenDirect.add(e.key);
      if (!e.known) { if (!e.seenBy.includes(byId[o.deviceId].name)) e.seenBy.push(byId[o.deviceId].name); e.port = r.remotePort || ''; }
      const g = grp(o.deviceId, r.localPort);
      if (!g.members.has(e.key)) g.members.set(e.key, { entity: e, via: r.via, remotePort: r.remotePort, direct: true });
      g.collectorSees = true;
    });
    // MAC table: a known device whose MAC is learnt on a port is on that wire too.
    (o.fdb || []).forEach((f) => {
      const id = macOwner[f.mac];
      if (!id || id === o.deviceId || !byId[id] || seenDirect.has(id)) return;
      const g = grp(o.deviceId, f.port);
      if (!g.members.has(id)) g.members.set(id, { entity: entityOfId(id), via: 'mac table', remotePort: '', direct: false });
    });
  });
  const gwDev = gateway && byIp[gateway] ? byIp[gateway] : null;

  // ---- who is next to whom (both ways, plus everything on the same wire)
  const nearby = {};
  const addNear = (id, e, via, port, kind) => {
    if (!id || e.key === id) return;
    const list = nearby[id] || (nearby[id] = []);
    const hit = list.find((x) => x.key === e.key);
    if (hit) { if (kind === 'direct' && hit.kind !== 'direct') { hit.kind = 'direct'; hit.via = via; } return; }
    list.push({ key: e.key, id: e.id, name: e.name, ip: e.ip, platform: e.platform || '', mac: e.mac || '', known: e.known, via, port: port || '', kind });
  };
  Object.keys(groups).forEach((k) => {
    const g = groups[k];
    const c = entityOfId(g.collector);
    const all = [{ entity: c, via: 'collector' }].concat(Array.from(g.members.values()));
    g.members.forEach((m) => {
      addNear(g.collector, m.entity, m.via, g.port, m.direct ? 'direct' : 'wire');
      addNear(m.entity.id, c, m.via, g.port, m.direct ? 'direct' : 'wire');
    });
    all.forEach((a) => all.forEach((b) => { if (a.entity.key !== b.entity.key && a.entity.id) addNear(a.entity.id, b.entity, 'same wire', g.port, 'wire'); }));
  });

  // ---- suggestions
  // A collector with the gateway on one port and other devices on another port sits BETWEEN them: it gets its
  // internet from the gateway side, and the things on its other ports get it from the collector (or from a
  // switch that is on that port). With only one port to go on, everything on the wire hangs off the switch.
  const suggestions = {};
  const suggest = (id, parentId, parentName, reason, how) => {
    if (!byId[id] || id === parentId) return;
    const cur = suggestions[id];
    if (cur && cur.confidence === 'high' && how !== 'high') return;
    suggestions[id] = { parentId: parentId || null, parentName: parentName || '', reason, confidence: how || 'medium' };
  };
  const isSwitch = (e) => kindOf(e.platform, e.name) === 'switch' || (e.known && byId[e.id] && byId[e.id].type === 'cisco');
  const nm = (e) => (e.known ? e.name : '"' + e.name + '" (' + (e.platform ? e.platform + ', ' : '') + 'not added yet)');
  if (gwDev) suggest(gwDev.id, 'internet', 'The internet', 'It is the default gateway that ' + (observations[0] && byId[observations[0].deviceId] ? byId[observations[0].deviceId].name : 'your routers') + ' use.', 'high');
  const byCollector = {};
  Object.keys(groups).forEach((k) => { (byCollector[groups[k].collector] = byCollector[groups[k].collector] || []).push(groups[k]); });
  const hasGw = (g) => gateway && Array.from(g.members.values()).some((m) => (gwDev && m.entity.id === gwDev.id) || m.entity.ip === gateway);
  Object.keys(byCollector).forEach((cid) => {
    const c = entityOfId(cid);
    const list = byCollector[cid];
    const up = list.find(hasGw);
    const downs = list.filter((g) => g !== up);
    const portTxt = (g) => (g.port ? ' on ' + g.port : '');
    if (up && downs.length && cid !== (gwDev && gwDev.id)) {
      // collector sits between the gateway side and the rest
      const upMembers = Array.from(up.members.values());
      const upSw = upMembers.map((m) => m.entity).find((e) => isSwitch(e));
      if (upSw && upSw.known) suggest(cid, upSw.id, upSw.name, c.name + ' reaches the switch ' + upSw.name + portTxt(up) + '.', 'medium');
      else if (gwDev) suggest(cid, gwDev.id, gwDev.name, c.name + ' reaches the gateway' + portTxt(up) + '; its other ports lead to the towers and sectors.', 'medium');
      downs.forEach((g) => {
        const members = Array.from(g.members.values());
        const sw = members.map((m) => m.entity).find((e) => isSwitch(e));
        members.forEach((m) => {
          const e = m.entity;
          if (!e.known || (sw && e.key === sw.key)) return;
          if (sw) suggest(e.id, sw.known ? sw.id : null, sw.name, 'It is on the same wire as the switch ' + nm(sw) + ' (seen by ' + c.name + portTxt(g) + ').', 'medium');
          else suggest(e.id, cid, c.name, 'Seen by ' + c.name + portTxt(g) + ' on the side away from the gateway.', 'medium');
        });
        if (sw && sw.known) suggest(sw.id, cid, c.name, 'The switch is on ' + c.name + portTxt(g) + ', the side away from the gateway.', 'high');
      });
      return;
    }
    // one wire: everything hangs off the switch when there is one
    list.forEach((g) => {
      const members = [{ entity: c, direct: true }].concat(Array.from(g.members.values()));
      const sw = members.map((m) => m.entity).find((e) => isSwitch(e));
      if (!sw) return;
      members.forEach((m) => {
        const e = m.entity;
        if (e.key === sw.key || !e.known || (gwDev && e.id === gwDev.id)) return;
        suggest(e.id, sw.known ? sw.id : null, sw.name, 'It is on the same wire as the switch ' + nm(sw) + portTxt(g) + '.', e.id === cid ? 'high' : 'medium');
      });
      if (sw.known && gwDev && members.some((m) => m.entity.id === gwDev.id)) suggest(sw.id, gwDev.id, gwDev.name, 'The switch and the gateway are on the same wire.', 'medium');
    });
  });
  // Never suggest a loop or something that is already so.
  const loops = (id, pid) => { let cur = pid, n = 0; while (cur && cur !== 'internet' && n++ < 20) { if (cur === id) return true; const s = suggestions[cur]; cur = s ? s.parentId : (byId[cur] || {}).parentId; } return false; };
  Object.keys(suggestions).forEach((id) => {
    const s = suggestions[id];
    if (s.parentId && s.parentId !== 'internet' && loops(id, s.parentId)) delete suggestions[id];
    else if (byId[id].parentId && byId[id].parentId === s.parentId) s.already = true;
  });
  // A suggestion whose parent is a not-yet-added switch still helps: remember what to add first.
  Object.keys(suggestions).forEach((id) => { const s = suggestions[id]; if (!s.parentId) s.needsAdding = true; });

  const unknownList = Object.keys(unknown).map((k) => {
    const u = unknown[k];
    return { key: u.key, name: u.name, ip: u.ip, mac: u.mac, platform: u.platform, kind: kindOf(u.platform, u.name) || 'device', typeHint: typeHint(u.platform), seenBy: u.seenBy, port: u.port || '' };
  }).sort((a, b) => (a.kind === 'switch' ? 0 : 1) - (b.kind === 'switch' ? 0 : 1) || a.name.localeCompare(b.name));

  Object.keys(nearby).forEach((id) => nearby[id].sort((a, b) => (a.kind === 'direct' ? 0 : 1) - (b.kind === 'direct' ? 0 : 1) || a.name.localeCompare(b.name)));
  return { gateway: gateway || '', gatewayId: gwDev ? gwDev.id : null, nearby, suggestions, unknown: unknownList };
}

// Per port of a switch: how many devices it has learnt behind that port, and the neighbours it sees there.
// `parsed` is the result of fromSnmpTables / fromMikrotikTables for that switch. { portName: { macCount, neighbors: [...] } }
function portMeta(parsed) {
  const out = {};
  const slot = (n) => out[n] || (out[n] = { macCount: 0, neighbors: [] });
  ((parsed && parsed.fdb) || []).forEach((f) => { if (f.port) slot(f.port).macCount++; });
  ((parsed && parsed.rows) || []).forEach((r) => {
    if (!r.localPort) return;
    slot(r.localPort).neighbors.push({ name: r.name || r.ip || r.mac, ip: r.ip || '', mac: r.mac || '', platform: r.platform || '', port: r.remotePort || '', via: r.via });
  });
  return out;
}

// ---------------- store (data/neighbors.json) ----------------
function load() { try { const v = JSON.parse(fs.readFileSync(FILE, 'utf8')); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function save(all) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(all));
  fs.renameSync(tmp, FILE);
}
function observations() { const all = load(); return Object.keys(all).map((id) => Object.assign({ deviceId: id }, all[id])); }
function put(deviceId, obs) { const all = load(); all[deviceId] = Object.assign({ at: new Date().toISOString() }, obs); save(all); }
function forget(deviceId) { const all = load(); if (all[deviceId]) { delete all[deviceId]; save(all); } }

// ---------------- collecting ----------------
// Which devices can tell us about their neighbours: routers/switches reached through the MikroTik API or SNMP.
function canScan(d) { return !!d && ['mikrotik', 'mikrotik-ssl', 'snmp', 'snmp1'].includes(d.method); }

async function collect(device, devices, transports) {
  const opts = devices.connectionOptions(devices.get(device.id) || device);
  if (device.method === 'snmp' || device.method === 'snmp1') {
    const raw = await transports.snmp.readNeighborTables({ host: opts.host, port: opts.port || 161, community: opts.community, version: device.method === 'snmp1' ? '1' : '2c' });
    return fromSnmpTables(raw);
  }
  const s = await transports.mikrotik.Session.open({ host: opts.host, port: opts.port || undefined, username: opts.username, password: opts.password, secure: device.method === 'mikrotik-ssl' });
  try { return fromMikrotikTables(await transports.mikrotik.readNeighborTables(s)); } finally { s.close(); }
}

// Reads every device that can be asked, a few at a time. Never throws: a device that does not answer is reported.
async function scan(deviceList, devices, transports, only) {
  const todo = (deviceList || []).filter((d) => canScan(d) && (!only || d.id === only));
  const report = [];
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const d = todo[next++];
      try {
        const obs = await collect(d, devices, transports);
        put(d.id, obs);
        report.push({ id: d.id, name: d.name, ok: true, neighbours: obs.rows.length });
      } catch (e) {
        report.push({ id: d.id, name: d.name, ok: false, error: e && e.kind === 'auth' ? 'wrong login' : (e && e.message) || 'no answer' });
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return report;
}

module.exports = { portMeta, normMac, normIp, nameKey, kindOf, typeHint, fromSnmpTables, fromMikrotikTables, analyse, observations, put, forget, canScan, scan, collect };
