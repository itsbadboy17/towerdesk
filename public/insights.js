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
    // Traffic of a device in bits per second (rx + tx of every interface), 0 when unknown.
    function trafficBps(d) {
        var ifs = (d.metrics && d.metrics.interfaces) || [];
        return ifs.reduce(function (a, i) { return a + (i.rxBps || 0) + (i.txBps || 0); }, 0);
    }
    function capacityPct(d) {
        var r = (d.metrics || {}).radio || {};
        return (r.throughput != null && r.rxRate) ? Math.round((r.throughput / r.rxRate) * 100) : null;
    }

    // Thresholds are deliberately simple and conservative.
    var ATT = { linkSignal: -70, linkCapacity: 85, staSignal: -73, staCcq: 70, cpu: 85 };

    // The few things worth looking at first. Devices whose network is unreachable are skipped
    // (their state is unknown). `sasByMac` maps a station MAC key to its subscriber, if known.
    function attention(devices, sasByMac) {
        var ago = window.TowerDesk.fmt.ago;
        var out = [];
        var add = function (sev, id, what, why, rank) { out.push({ sev: sev, id: id, what: what, why: why, rank: rank }); };
        (devices || []).forEach(function (d) {
            if (d.unreachable || d.online === null || d.online === undefined) return;
            if (d.online === false) { add('critical', d.id, d.name, 'offline' + (d.since ? ' for ' + ago(d.since) : ''), 0); return; }
            var mx = d.metrics || {};
            var r = mx.radio || {};
            if (d.lastTest && d.lastTest.ok === false) add('warning', d.id, d.name, 'answers, but the login is not working', 1);
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
        });
        return out.sort(function (a, b) { return a.rank - b.rank; });
    }

    // Loads SAS subscribers and indexes them by the MAC of the station they were traced to.
    function loadSasByMac(demo) {
        return fetch('/api/radius/subscribers' + (demo ? '?demo=1' : ''))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                var byMac = {};
                ((j && j.subscribers) || []).forEach(function (s) { var k = macKey(s.station ? s.station.mac : ''); if (k.length === 12) byMac[k] = s; });
                return { configured: !!(j && j.configured), byMac: byMac, data: j };
            });
    }

    window.TowerDesk.insights = {
        macKey: macKey, peerOf: peerOf, isFarEnd: isFarEnd, attention: attention, loadSasByMac: loadSasByMac,
        topIface: topIface, trafficBps: trafficBps, capacityPct: capacityPct, ATT: ATT
    };
})();
