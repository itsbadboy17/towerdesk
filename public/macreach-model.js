// Reaching a MikroTik that has no IP yet, through another MikroTik on the same switch (MAC-Telnet), and giving it
// an address. Pure functions shared by the page and the server (tested in Node). Nothing here touches the network.
//
// The commands are FIXED: only the values below are placed in them, and every value is checked against a narrow
// pattern first (no quotes, no slashes except in the prefix, no semicolons, no spaces), so nothing typed can add
// a second command.
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.macreachModel = api; }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    var IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
    var NAME_RE = /^[A-Za-z0-9._-]{1,32}$/;
    var IFACE_RE = /^[A-Za-z0-9_-]{1,24}$/;
    var PASS_RE = /^[A-Za-z0-9._@#%+=:,!^*()-]{1,64}$/;
    var FACTORY_USER_RE = /^[A-Za-z0-9._-]{1,32}$/;
    var FACTORY_PASS_RE = /^[A-Za-z0-9._@#%+=:,!^*()-]{0,64}$/;
    var COMMENT = 'TowerDesk setup';

    function ipNum(a) { return String(a).split('.').reduce(function (n, x) { return n * 256 + Number(x); }, 0) >>> 0; }
    function numIp(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); }
    function maskOf(prefix) { return prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0; }
    function sameNet(a, b, prefix) { return ((ipNum(a) & maskOf(prefix)) >>> 0) === ((ipNum(b) & maskOf(prefix)) >>> 0); }
    function firstHost(ip, prefix) { return numIp((((ipNum(ip) & maskOf(prefix)) >>> 0) + 1) >>> 0); }
    // A free address next to the relay (same /24), so TowerDesk can reach the new router the way it reaches the relay.
    // taken: addresses already in use (devices, ARP, neighbours). Starts at .2 (.1 is usually the gateway).
    function suggestIp(relayIp, taken) {
        if (!okIp(relayIp)) return '';
        var used = {}; (taken || []).concat([relayIp]).forEach(function (t) { used[t] = 1; });
        var base = (ipNum(relayIp) & maskOf(24)) >>> 0;
        for (var h = 2; h < 255; h++) { var ip = numIp(base + h); if (!used[ip]) return ip; }
        return '';
    }
    function okIp(v) { return IP_RE.test(String(v)) && String(v).split('.').every(function (n) { return Number(n) <= 255; }); }
    function privateIp(v) { var p = String(v).split('.').map(Number); return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168); }

    // input: { mac, factoryUser, factoryPass, ip, prefix, gateway, name, newPassword, interface, allowApiFrom }
    // -> { ok, errors, clean }
    function validate(input) {
        input = input || {};
        var e = {}, c = {};
        var mac = String(input.mac || '').trim();
        if (!MAC_RE.test(mac)) e.mac = 'The router\'s MAC address looks like 4C:5E:0C:8A:1F:88.'; else c.mac = mac.toUpperCase();
        var fu = String(input.factoryUser === undefined || input.factoryUser === '' ? 'admin' : input.factoryUser).trim();
        if (!FACTORY_USER_RE.test(fu)) e.factoryUser = 'Use letters, numbers, dot, dash or underscore.'; else c.factoryUser = fu;
        var fp = String(input.factoryPass === undefined || input.factoryPass === null ? '' : input.factoryPass);
        if (!FACTORY_PASS_RE.test(fp)) e.factoryPass = 'That password has characters TowerDesk does not accept here.'; else c.factoryPass = fp;
        var ip = String(input.ip || '').trim();
        if (!okIp(ip) || !privateIp(ip)) e.ip = 'Give it a free private address, for example 10.118.82.40.'; else c.ip = ip;
        var prefix = Number(input.prefix === undefined || input.prefix === '' ? 24 : input.prefix);
        if (!(Number.isInteger(prefix) && prefix >= 8 && prefix <= 30)) e.prefix = 'The network size is 8 to 30 (24 means 255.255.255.0).'; else c.prefix = prefix;
        var gw = String(input.gateway || '').trim();
        if (gw && (!okIp(gw) || !privateIp(gw))) e.gateway = 'The gateway is an address like 10.118.82.1, or empty.'; else if (gw) c.gateway = gw;
        var name = String(input.name || '').trim();
        if (name && !NAME_RE.test(name)) e.name = 'Use letters, numbers, dot, dash or underscore, up to 32.'; else if (name) c.name = name;
        var np = String(input.newPassword || '');
        if (np && !PASS_RE.test(np)) e.newPassword = 'Use letters, numbers and . _ @ # % + = : , ! ^ * ( ) - (up to 64).'; else if (np) c.newPassword = np;
        var ifc = String(input.interface || 'ether1').trim();
        if (!IFACE_RE.test(ifc)) e.interface = 'An interface name such as ether1 or bridge.'; else c.interface = ifc;
        var af = String(input.allowApiFrom || '').trim();
        if (af && !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(af)) e.allowApiFrom = 'An address range like 10.118.82.0/24, or empty.'; else if (af) c.allowApiFrom = af;
        // Left empty: the first address of its network (10.118.82.1 for 10.118.82.40/24), unless that is the router itself.
        if (c.ip && !gw && c.prefix !== undefined) { var g = firstHost(c.ip, c.prefix); if (g !== c.ip) c.gateway = g; }
        if (c.ip && c.gateway) {
            // the gateway must be inside the same network, or the router could not reach it
            var mask = c.prefix === 0 ? 0 : (~0 << (32 - c.prefix)) >>> 0;
            var num = function (a) { return a.split('.').reduce(function (n, x) { return n * 256 + Number(x); }, 0) >>> 0; };
            if ((num(c.ip) & mask) !== (num(c.gateway) & mask)) e.gateway = 'The gateway is not inside the same network as the new address.';
        }
        return { ok: Object.keys(e).length === 0, errors: e, clean: c };
    }

    // The commands typed on the new router, in order. `secret` marks the line that carries a password: it is shown
    // masked in the preview but sent as is. Every address TowerDesk adds carries a comment so it can be found and removed.
    function script(c) {
        var lines = [];
        lines.push({ cmd: '/ip address add address=' + c.ip + '/' + c.prefix + ' interface=' + c.interface + ' comment="' + COMMENT + '"', why: 'Give the router an address so TowerDesk can reach it.' });
        if (c.gateway) lines.push({ cmd: '/ip route add dst-address=0.0.0.0/0 gateway=' + c.gateway + ' comment="' + COMMENT + '"', why: 'Let it answer from outside its own network (your VPN).' });
        lines.push({ cmd: '/ip service set api disabled=no', why: 'Turn on the MikroTik API that TowerDesk reads with.' });
        if (c.allowApiFrom) lines.push({ cmd: '/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=' + c.allowApiFrom + ' action=accept place-before=0 comment="' + COMMENT + '"', why: 'Allow the API from your management network (the default firewall blocks it on the WAN port).' });
        if (c.name) lines.push({ cmd: '/system identity set name=' + c.name, why: 'Give it its name.' });
        if (c.newPassword) lines.push({ cmd: '/user set [find name=' + c.factoryUser + '] password=' + c.newPassword, mask: 'password=', why: 'Replace the factory password.' });
        return lines;
    }
    // The commands that undo what TowerDesk added (used if the router cannot be reached afterwards).
    function revertScript(c) {
        var lines = ['/ip address remove [find comment="' + COMMENT + '"]', '/ip route remove [find comment="' + COMMENT + '"]'];
        if (c.allowApiFrom) lines.push('/ip firewall filter remove [find comment="' + COMMENT + '"]');
        return lines;
    }
    function maskLine(l) { return l.mask ? l.cmd.replace(new RegExp(l.mask + '\\S+'), l.mask + '••••••••') : l.cmd; }

    // Text the router prints when a command did not work.
    var ERROR_RE = /(failure:|bad command name|syntax error|expected end of command|invalid value|input does not match|no such item|not enough permissions|already have such address)/i;

    // What the relay sees next to it, as a list to choose the new router from, so nobody has to find and type a MAC
    // address. rows: [{ mac, name, model, version, ip, port (the relay's port), farPort (the other device's port),
    // mikrotik (bool), knownAs (the TowerDesk device it already is, or '') }]. Only a MikroTik that TowerDesk does not
    // have yet can be chosen: MAC-Telnet is a MikroTik feature. New ones come first, those with no address before the rest.
    function candidates(rows) {
        var out = (rows || []).filter(function (r) { return r && MAC_RE.test(String(r.mac || '')); }).map(function (r) {
            var why = r.knownAs ? 'Already in TowerDesk as ' + r.knownAs + '.' : (r.mikrotik ? '' : 'Not a MikroTik, so it cannot be reached by its MAC address.');
            return { mac: String(r.mac).toUpperCase(), name: String(r.name || ''), model: String(r.model || ''), version: String(r.version || ''), ip: String(r.ip || ''),
                port: String(r.port || ''), farPort: String(r.farPort || ''), mikrotik: !!r.mikrotik, knownAs: String(r.knownAs || ''), can: !why, why: why };
        });
        var rank = function (c) { return c.can ? (c.ip ? 1 : 0) : (c.knownAs ? 2 : 3); };
        return out.sort(function (a, b) { return rank(a) - rank(b) || a.name.localeCompare(b.name) || a.mac.localeCompare(b.mac); });
    }
    // The new router's own port that faces the relay, as a name an address can be put on. A port inside a bridge is
    // reported as "bridge/ether2": the address belongs on the bridge. '' when the name is not one TowerDesk accepts.
    function facingPort(farPort) {
        var p = String(farPort || '').split('/')[0].trim();
        return IFACE_RE.test(p) ? p : '';
    }

    return { suggestIp: suggestIp, sameNet: sameNet, firstHost: firstHost, validate: validate, script: script, revertScript: revertScript, maskLine: maskLine, candidates: candidates, facingPort: facingPort, ERROR_RE: ERROR_RE, COMMENT: COMMENT, MAC_RE: MAC_RE };
}));
