/* TowerDesk shared network logic for the Monitoring, Overview and Topology pages: which end of a
   paired link is the far end, and the "needs attention" rules. Pure functions over a monitor
   snapshot's device list, so every page agrees. */
(function () {
    'use strict';
    window.TowerDesk = window.TowerDesk || {};

    function macKey(m) { return String(m || '').toLowerCase().replace(/[^0-9a-f]/g, ''); }

    // The other managed end of a paired backhaul link, or null.
    function peerOf(d, devices) {
        if (!d || !d.peerId || d.role !== 'backhaul' || !devices) return null;
        var p = devices.find(function (x) { return x.id === d.peerId; });
        return p && p.role === 'backhaul' ? p : null;
    }
    function masterRank(d) { var m = ((d.metrics || {}).radio || {}).mode; return m && /^(ap|master)/i.test(String(m)) ? 1 : 0; }
    // True for the end that is folded into its peer's card (the master/AP side when known).
    function isFarEnd(d, devices) {
        var p = peerOf(d, devices);
        if (!p) return false;
        var a = masterRank(d), b = masterRank(p);
        return a !== b ? a > b : String(p.id) < String(d.id);
    }

    function topIface(d) { var mx = d.metrics || {}; return mx.interfaces && mx.interfaces[0]; }
    // Traffic through a device in bits per second: download + upload of its busiest interface,
    // 0 when unknown.
    function trafficBps(d) {
        var ifs = (d.metrics && d.metrics.interfaces) || [], best = 0;
        ifs.forEach(function (i) { var v = (i.rxBps || 0) + (i.txBps || 0); if (v > best) best = v; });
        return best;
    }
    function capacityPct(d) {
        var r = (d.metrics || {}).radio || {};
        return (r.throughput != null && r.rxRate) ? Math.round((r.throughput / r.rxRate) * 100) : null;
    }

    // Thresholds are deliberately simple and conservative.
    var ATT = { linkSignal: -70, linkCapacity: 85, staSignal: -73, staCcq: 70, cpu: 85, onuRx: -27, onuTemp: 75 };

    // One key for a station or an ONU: its MAC, or the serial number for a GPON ONU.
    function staKey(c) {
        var k = macKey(c && c.mac);
        return k.length === 12 ? k : (c && c.serial ? 'sn:' + String(c.serial).toUpperCase() : '');
    }

    // The few things worth looking at first. Devices whose network is unreachable are skipped
    // (their state is unknown). `sasByMac` maps a station MAC key to its subscriber, if known.
    function attention(devices, sasByMac) {
        var ago = window.TowerDesk.fmt.ago;
        var out = [];
        var add = function (sev, id, what, why, rank) { out.push({ sev: sev, id: id, what: what, why: why, rank: rank }); };
        (devices || []).forEach(function (d) {
            if (d.unreachable || d.online === null || d.online === undefined) return;
            // Planned work: shown, but not as a fault.
            if (d.maintenance) { add('maint', d.id, d.name, 'in maintenance until ' + new Date(d.maintenance.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + (d.maintenance.reason ? ' (' + d.maintenance.reason + ')' : ''), 5); return; }
            if (d.online === false) {
                // What depends on it: devices behind it in the diagram and the customers on them.
                var IM = window.TowerDesk.impactModel, dep = IM ? IM.sentence(IM.impact(devices, d.id)) : '';
                add('critical', d.id, d.name, 'offline' + (d.since ? ' for ' + ago(d.since) : '') + (dep ? ' · ' + dep : ''), 0);
                return;
            }
            var mx = d.metrics || {};
            var r = mx.radio || {};
            if (d.lastTest && d.lastTest.ok === false) {
                var kind = window.TowerDesk.loginProblem ? window.TowerDesk.loginProblem(d.lastTest.error) : 'other';
                add('warning', d.id, d.name, { auth: 'answers ping, but the saved username/password is wrong', timeout: 'answers ping, but its login page is not responding (timed out)', refused: 'answers ping, but its login port is closed' }[kind] || 'answers ping, but the login did not work', 1);
            }
            if (mx.cpu && mx.cpu.now >= ATT.cpu) add('warning', d.id, d.name, 'CPU at ' + mx.cpu.now + '%', 4);
            if (d.role === 'backhaul' && !isFarEnd(d, devices)) {
                if (r.signal != null && r.signal <= ATT.linkSignal) add('warning', d.id, d.name, 'weak link signal, ' + r.signal + ' dBm', 2);
                var cap = capacityPct(d);
                if (cap != null && cap >= ATT.linkCapacity) add('warning', d.id, d.name, 'link at ' + cap + '% of its capacity', 2);
            }
            (mx.stations || []).forEach(function (c) {
                var bad = [];
                if (c.signal != null && c.signal <= ATT.staSignal) bad.push(c.signal + ' dBm');
                if (c.ccq != null && c.ccq < ATT.staCcq) bad.push('CCQ ' + c.ccq + '%');
                if (!bad.length) return;
                var s = sasByMac && sasByMac[macKey(c.mac)];
                add('warning', d.id, (s ? s.username : (c.name || c.mac)) + ' on ' + d.name, 'weak radio link: ' + bad.join(', '), 3);
            });
            // Fibre: weak light at the ONU (dirty connector, bend, too many splits) or a hot ONU.
            // Summed up per OLT when there are many, so one bad splitter does not flood the list.
            var weak = [];
            (mx.onus || []).forEach(function (c) {
                if (c.online === false) return;
                var bad = [];
                if (c.signal != null && c.signal <= ATT.onuRx) bad.push(c.signal + ' dBm');
                if (c.temp != null && c.temp >= ATT.onuTemp) bad.push(c.temp + ' °C');
                if (!bad.length) return;
                var s = sasByMac && sasByMac[staKey(c)];
                weak.push({ who: s ? s.username : (c.name || c.serial || c.mac || c.port), why: bad.join(', ') });
            });
            if (weak.length > 5) add('warning', d.id, weak.length + ' ONUs on ' + d.name, 'weak optical power or running hot', 3);
            else weak.forEach(function (w) { add('warning', d.id, w.who + ' on ' + d.name, 'weak fibre signal: ' + w.why, 3); });
        });
        return out.sort(function (a, b) { return a.rank - b.rank; });
    }

    // Loads SAS subscribers and indexes them by the MAC of the station they were traced to.
    function loadSasByMac(demo) {
        return fetch('/api/radius/subscribers' + (demo ? '?demo=1' : ''))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                var byMac = {};
                ((j && j.subscribers) || []).forEach(function (s) { var k = s.station ? staKey(s.station) : ''; if (k) byMac[k] = s; });
                return { configured: !!(j && j.configured), byMac: byMac, data: j };
            });
    }

    window.TowerDesk.insights = {
        macKey: macKey, staKey: staKey, peerOf: peerOf, isFarEnd: isFarEnd, attention: attention, loadSasByMac: loadSasByMac,
        topIface: topIface, trafficBps: trafficBps, capacityPct: capacityPct, ATT: ATT
    };
})();
