// What is behind a device. Pure functions shared by the pages and the server (tested in Node).
// "Behind" comes from the link diagram: a device's parentId says what it gets its internet from, so
// everything below it loses service when it is down. Customers are the registered customer radios on
// each sector (or ONUs on an OLT), using the last count seen when the device is offline.
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.impactModel = api; }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function customersOf(d) {
        var m = (d && d.metrics) || {};
        if (m.stationCount != null) return m.stationCount;
        if (m.stationCountLast != null) return m.stationCountLast;
        if (m.onuCount != null) return m.onuCount;
        if (m.stations && m.stations.length) return m.stations.length;
        return 0;
    }

    // Every device below `id` in the diagram (children, their children, ...). Safe against loops.
    function below(devices, id) {
        var kids = {};
        (devices || []).forEach(function (d) { if (d.parentId && d.parentId !== 'internet') (kids[d.parentId] = kids[d.parentId] || []).push(d); });
        var out = [], seen = {};
        seen[id] = true;
        var queue = (kids[id] || []).slice();
        while (queue.length) {
            var d = queue.shift();
            if (seen[d.id]) continue;
            seen[d.id] = true;
            out.push(d);
            (kids[d.id] || []).forEach(function (c) { queue.push(c); });
        }
        return out;
    }

    // { devices: [ids below], deviceCount, customers, ownCustomers, sectors, sites: [names], treeKnown }
    function impact(devices, id) {
        devices = devices || [];
        var self = devices.filter(function (d) { return d.id === id; })[0];
        if (!self) return { devices: [], deviceCount: 0, customers: 0, ownCustomers: 0, sectors: 0, sites: [], treeKnown: false };
        var under = below(devices, id);
        var all = [self].concat(under);
        var sites = {};
        all.forEach(function (d) { if (d.location) sites[String(d.location).trim()] = true; });
        return {
            devices: under.map(function (d) { return d.id; }),
            deviceCount: under.length,
            customers: all.reduce(function (n, d) { return n + customersOf(d); }, 0),
            ownCustomers: customersOf(self),
            sectors: all.filter(function (d) { return d.role === 'sector'; }).length,
            sites: Object.keys(sites),
            treeKnown: devices.some(function (d) { return d.parentId; })
        };
    }

    function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

    // "3 devices behind it and about 87 customers" (empty when nothing is known to depend on it)
    function sentence(imp) {
        var parts = [];
        if (imp.deviceCount) parts.push(plural(imp.deviceCount, 'device') + ' behind it');
        if (imp.customers) parts.push('about ' + plural(imp.customers, 'customer'));
        return parts.join(' and ');
    }

    return { customersOf: customersOf, below: below, impact: impact, sentence: sentence, plural: plural };
}));
