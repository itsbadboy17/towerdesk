/* TowerDesk Topology logic: grouping devices into sites, the "what connects to what" graph and its
   layout, and tracing one customer back to the internet. Pure functions over a monitor snapshot's
   device list (no DOM, no network), so the page stays small and this file is unit-tested in Node. */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.topo = api; }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    var ATT = { staSignal: -73, staCcq: 70, onuRx: -27, onuTemp: 75 };
    function att(a) { return a || ATT; }
    function keyOf(m) { return String(m || '').toLowerCase().replace(/[^0-9a-f]/g, ''); }

    // ---------------- sites ----------------
    function siteKey(loc) { return String(loc || '').trim().toLowerCase(); }

    // [{ key, name, devices }] — sites by name, devices not on a site last (key '').
    function groupSites(devices) {
        var map = {}, order = [];
        (devices || []).forEach(function (d) {
            var k = siteKey(d.location);
            if (!map[k]) { map[k] = { key: k, name: k ? String(d.location).trim() : '', devices: [] }; order.push(k); }
            map[k].devices.push(d);
        });
        var list = order.map(function (k) { return map[k]; });
        list.forEach(function (g) { g.devices.sort(function (a, b) { return a.name.localeCompare(b.name); }); });
        list.sort(function (a, b) {
            if (!a.key !== !b.key) return a.key ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return list;
    }

    // 'unknown' | 'down' | 'warn' | 'up'. `attnById` maps a device id to true when it needs attention.
    function healthOf(d, attnById) {
        if (!d || d.unreachable || d.online === null || d.online === undefined) return 'unknown';
        if (d.online === false) return 'down';
        return attnById && attnById[d.id] ? 'warn' : 'up';
    }

    // Counts for one site's header. A sector whose client list could not be read is counted in
    // `notRead` instead of being shown as "0 customers".
    function siteSummary(devices, attnById) {
        var s = { total: devices.length, up: 0, down: 0, warn: 0, unknown: 0, sectors: 0, customers: 0, notRead: 0, worst: 'up' };
        devices.forEach(function (d) {
            var h = healthOf(d, attnById);
            s[h]++;
            var mx = d.metrics || {};
            if (d.role === 'sector') s.sectors++;
            if (mx.stationCount != null) s.customers += mx.stationCount;
            else if (mx.onuCount != null) s.customers += mx.onuCount;
            else if (d.role === 'sector') s.notRead++;
        });
        s.worst = s.down ? 'down' : s.warn ? 'warn' : s.unknown && s.unknown === s.total ? 'unknown' : 'up';
        return s;
    }

    // ---------------- connections graph ----------------
    // One node per box: the two ends of a paired backhaul link are one node ("far ⇄ near").
    // `I` is TowerDesk.insights (peerOf / isFarEnd). parent is a node id, 'internet', or null
    // (not connected yet).
    function buildGraph(devices, I) {
        devices = devices || [];
        var byId = {};
        devices.forEach(function (d) { byId[d.id] = d; });
        var repOf = {};
        devices.forEach(function (d) {
            var p = I.peerOf(d, devices);
            repOf[d.id] = p && I.isFarEnd(d, devices) ? p.id : d.id;
        });
        var nodes = {}, list = [];
        devices.forEach(function (d) {
            if (repOf[d.id] !== d.id) return;
            var peer = I.peerOf(d, devices);
            var n = { id: d.id, d: d, far: peer || null, label: peer ? peer.name + ' ⇄ ' + d.name : d.name, parent: null, children: [] };
            nodes[d.id] = n; list.push(n);
        });
        list.forEach(function (n) {
            var pid = n.d.parentId || (n.far && n.far.parentId) || null;
            if (pid === 'internet') n.parent = 'internet';
            else if (pid && byId[pid]) { var r = repOf[pid]; n.parent = r !== n.id && nodes[r] ? r : null; }
        });
        // A saved loop (should not happen) would hide its members; cut it at the first repeat.
        list.forEach(function (n) {
            var seen = {}, cur = n;
            while (cur && cur.parent && cur.parent !== 'internet') {
                if (seen[cur.id]) { cur.parent = null; break; }
                seen[cur.id] = true; cur = nodes[cur.parent];
            }
        });
        list.forEach(function (n) { if (n.parent && n.parent !== 'internet') nodes[n.parent].children.push(n); });
        var byLabel = function (a, b) { return a.label.localeCompare(b.label); };
        list.forEach(function (n) { n.children.sort(byLabel); });
        return {
            nodes: nodes, list: list, repOf: repOf,
            roots: list.filter(function (n) { return n.parent === 'internet'; }).sort(byLabel),
            loose: list.filter(function (n) { return !n.parent; }).sort(byLabel)
        };
    }

    // Tidy top-down layout. Returns { pos: { id: {x,y} }, edges: [{from,to}], internet, width, height,
    // looseTop } with x,y the top-left of each box.
    function layout(graph, o) {
        o = o || {};
        var W = o.nodeW || 164, H = o.nodeH || 54, GX = o.gapX || 22, GY = o.gapY || 52, PAD = 16;
        var widths = {};
        function width(n) {
            if (widths[n.id] != null) return widths[n.id];
            var kids = n.children.reduce(function (a, c) { return a + width(c); }, 0) + Math.max(0, n.children.length - 1) * GX;
            return (widths[n.id] = Math.max(W, kids));
        }
        var pos = {}, edges = [], maxY = 0;
        function place(n, left, y) {
            var w = width(n);
            pos[n.id] = { x: left + (w - W) / 2, y: y };
            maxY = Math.max(maxY, y + H);
            var x = left;
            n.children.forEach(function (c) { place(c, x, y + H + GY); edges.push({ from: n.id, to: c.id }); x += width(c) + GX; });
        }
        var top = PAD + H + GY; // the Internet box sits above the first level
        var x = PAD, total = 0;
        graph.roots.forEach(function (r) { place(r, x, top); x += width(r) + GX; });
        total = graph.roots.length ? x - GX - PAD : 0;
        var treeW = Math.max(total, W);
        var internet = { x: PAD + (treeW - W) / 2, y: PAD };
        graph.roots.forEach(function (r) { edges.push({ from: 'internet', to: r.id }); });
        var width_ = PAD * 2 + treeW;
        // Devices with no connection yet: their own rows underneath, wrapped to the tree's width.
        var looseTop = graph.loose.length ? (graph.roots.length ? maxY + GY : PAD) : null;
        if (looseTop !== null) {
            var perRow = Math.max(1, Math.floor((Math.max(width_, 3 * (W + GX) + PAD * 2) - PAD * 2 + GX) / (W + GX)));
            graph.loose.forEach(function (n, i) {
                pos[n.id] = { x: PAD + (i % perRow) * (W + GX), y: looseTop + 28 + Math.floor(i / perRow) * (H + 16) };
                maxY = Math.max(maxY, pos[n.id].y + H);
            });
            width_ = Math.max(width_, PAD * 2 + Math.min(perRow, graph.loose.length) * (W + GX) - GX);
        }
        if (!graph.roots.length) maxY = Math.max(maxY, PAD + H);
        return { pos: pos, edges: edges, internet: graph.roots.length ? internet : null, width: width_, height: maxY + PAD, looseTop: looseTop, nodeW: W, nodeH: H };
    }

    // ---------------- find a customer ----------------
    // Everything searchable: radios on sectors, ONUs on OLTs, and SAS customers with no radio.
    // `sasByKey` maps a station key (MAC, or sn:SERIAL) to the SAS subscriber traced to it.
    function candidates(devices, sasByKey, sasList) {
        var out = [], seenSas = {};
        (devices || []).forEach(function (d) {
            var mx = d.metrics || {};
            (mx.stations || []).forEach(function (c) {
                var k = keyOf(c.mac), s = sasByKey && sasByKey[k];
                if (s) seenSas[s.username] = true;
                out.push({ type: 'radio', deviceId: d.id, st: c, sas: s || null, label: s ? s.username : (c.name || c.mac || c.ip) });
            });
            (mx.onus || []).forEach(function (c) {
                var k = keyOf(c.mac) || (c.serial ? 'sn:' + String(c.serial).toUpperCase() : '');
                var s = sasByKey && sasByKey[k];
                if (s) seenSas[s.username] = true;
                out.push({ type: 'onu', deviceId: d.id, st: c, sas: s || null, label: s ? s.username : (c.name || c.serial || c.mac || c.port) });
            });
        });
        (sasList || []).forEach(function (s) {
            if (!seenSas[s.username]) out.push({ type: 'sas', deviceId: null, st: null, sas: s, label: s.username });
        });
        return out;
    }

    function haystack(c) {
        var st = c.st || {}, s = c.sas || {};
        return [c.label, st.name, st.mac, keyOf(st.mac), st.ip, st.serial, st.port, s.username, s.name, s.mac, keyOf(s.mac), s.framedIp, s.phone]
            .filter(Boolean).join(' ').toLowerCase();
    }
    function search(cands, q, limit) {
        q = String(q || '').trim().toLowerCase();
        if (q.length < 2) return [];
        var qk = keyOf(q);
        var hits = cands.filter(function (c) { var h = haystack(c); return h.indexOf(q) !== -1 || (qk.length >= 4 && h.indexOf(qk) !== -1); });
        hits.sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
        return hits.slice(0, limit || 12);
    }

    function weakRadio(st, a) {
        var bad = [];
        if (st.signal != null && st.signal <= a.staSignal) bad.push(st.signal + ' dBm');
        if (st.ccq != null && st.ccq < a.staCcq) bad.push('CCQ ' + st.ccq + '%');
        return bad;
    }

    // The path from one customer up to the internet: [{ kind, title, sub, state, deviceId }] and a
    // plain verdict { state, text }. `state` is 'up' | 'warn' | 'down' | 'unknown'.
    function chain(c, devices, I, attnById, a) {
        a = att(a);
        var hops = [], byId = {};
        (devices || []).forEach(function (d) { byId[d.id] = d; });
        var s = c.sas, st = c.st;
        var issues = [];

        if (s) {
            var offline = s.online === false;
            hops.push({ kind: 'customer', title: s.username, sub: [s.name, s.plan, offline ? 'session offline' : 'session online'].filter(Boolean).join(' · '), state: offline ? 'warn' : 'up' });
            if (offline) issues.push({ rank: 3, text: 'The customer\'s PPPoE session is offline' + (st ? ' although their radio is connected' : '') + '.' });
        } else if (st) {
            hops.push({ kind: 'customer', title: c.label, sub: 'not matched to a SAS user', state: 'unknown' });
        }
        if (!st) {
            hops.push({ kind: 'gap', title: 'No radio found', sub: 'This customer is not on any sector or OLT TowerDesk can read.', state: 'unknown' });
            issues.push({ rank: 4, text: 'No radio was found for this customer on the devices TowerDesk can read.' });
            return { hops: hops, verdict: verdictOf(hops, issues) };
        }

        var dev = byId[c.deviceId];
        if (c.type === 'onu') {
            var bad = [], hot = st.temp != null && st.temp >= a.onuTemp;
            if (st.online === false) bad.push('offline');
            if (st.signal != null && st.signal <= a.onuRx) bad.push(st.signal + ' dBm');
            if (hot) bad.push(st.temp + ' °C');
            var state = st.online === false ? 'down' : bad.length ? 'warn' : 'up';
            hops.push({ kind: 'onu', title: 'ONU ' + (st.name || st.serial || st.port || ''), sub: [st.signal != null ? 'Rx ' + st.signal + ' dBm' : '', st.temp != null ? st.temp + ' °C' : '', st.distance != null ? st.distance + ' m' : '', st.online === false ? 'offline' : ''].filter(Boolean).join(' · '), state: state });
            if (st.online === false) issues.push({ rank: 1, text: 'The ONU is offline.' });
            else if (bad.length) issues.push({ rank: 2, text: 'Weak fibre signal or a hot ONU: ' + bad.join(', ') + '.' });
        } else {
            var wr = weakRadio(st, a);
            hops.push({ kind: 'radio', title: 'Radio ' + (st.name || st.mac || ''), sub: [st.signal != null ? st.signal + ' dBm' : '', st.ccq != null ? 'CCQ ' + st.ccq + '%' : '', st.txRate != null || st.rxRate != null ? (st.txRate != null ? st.txRate : '–') + '/' + (st.rxRate != null ? st.rxRate : '–') + ' Mbps' : ''].filter(Boolean).join(' · '), state: wr.length ? 'warn' : 'up' });
            if (wr.length) issues.push({ rank: 2, text: 'Weak radio link: ' + wr.join(', ') + '.' });
        }

        // Up the chain: this sector / OLT, then whatever each one says it connects to.
        var graph = buildGraph(devices, I), node = dev ? graph.nodes[graph.repOf[dev.id]] : null, guard = 0, reachedInternet = false;
        if (!dev) hops.push({ kind: 'gap', title: 'Device not found', sub: '', state: 'unknown' });
        while (node && guard++ < 30) {
            var d = node.d, h = healthOf(d, attnById);
            var r = (d.metrics || {}).radio || {};
            hops.push({
                kind: node.far ? 'link' : 'device', deviceId: d.id, title: node.label,
                sub: [d.role === 'sector' ? 'Sector' : d.role === 'backhaul' ? 'Backhaul' : (d.type === 'olt' ? 'OLT' : ''), r.signal != null && d.role === 'backhaul' ? r.signal + ' dBm' : '', h === 'down' ? 'offline' : h === 'unknown' ? 'state unknown' : ''].filter(Boolean).join(' · '),
                state: h
            });
            if (h === 'down') issues.push({ rank: 0, upstream: hops.length, text: node.label + ' is offline.' });
            if (node.parent === 'internet') { reachedInternet = true; break; }
            node = node.parent ? graph.nodes[node.parent] : null;
            if (!node) hops.push({ kind: 'gap', title: 'Where does it go next?', sub: 'Say what it connects to in the Link diagram to see the rest of the path.', state: 'unknown' });
        }
        if (reachedInternet) hops.push({ kind: 'internet', title: 'Internet', sub: '', state: 'up' });
        return { hops: hops, verdict: verdictOf(hops, issues, !reachedInternet) };
    }

    // `incomplete`: the path stops before the internet because nobody said what the last device
    // connects to, so "all fine" can only be claimed for the part that is known.
    function verdictOf(hops, issues, incomplete) {
        var downs = issues.filter(function (i) { return i.rank === 0; });
        if (downs.length) { downs.sort(function (x, y) { return y.upstream - x.upstream; }); return { state: 'down', text: downs[0].text + ' Everything behind it is affected.' }; }
        var rest = issues.filter(function (i) { return i.rank > 0; }).sort(function (x, y) { return x.rank - y.rank; });
        if (rest.length) return { state: rest[0].rank === 1 ? 'down' : 'warn', text: rest[0].text };
        var warn = hops.filter(function (h) { return h.state === 'warn' && (h.kind === 'device' || h.kind === 'link'); })[0];
        if (warn) return { state: 'warn', text: warn.title + ' needs attention.' };
        if (hops.some(function (h) { return h.state === 'unknown' && h.kind !== 'gap' && h.kind !== 'customer'; })) return { state: 'unknown', text: 'Some devices on the path cannot be reached right now, so their state is unknown.' };
        if (incomplete) return { state: 'up', text: 'Nothing looks wrong on the radio or the sector. What it connects to is not set up yet, so the rest of the path is not checked.' };
        return { state: 'up', text: 'Nothing looks wrong on this path.' };
    }

    // The same port is spelled differently by different tables (Et0/0, Ethernet0/0, bridge1/ether2, ether2): one key for all.
    function portKey(name) {
        return String(name || '').toLowerCase().replace(/^bridge\d*\//, '').replace(/^gigabitethernet/, 'gi').replace(/^fastethernet/, 'fa').replace(/^tengigabitethernet/, 'te').replace(/^ethernet/, 'et').replace(/\s+/g, '');
    }

    return { portKey: portKey, ATT: ATT, siteKey: siteKey, groupSites: groupSites, healthOf: healthOf, siteSummary: siteSummary, buildGraph: buildGraph, layout: layout, candidates: candidates, search: search, chain: chain, keyOf: keyOf };
});
