// The texts TowerDesk writes: team alerts, the status report, notices for customers, and WhatsApp links.
// Pure functions shared by the pages and the server (tested in Node). Nothing here sends anything.
(function (root, factory) {
    var impactModel = typeof module === 'object' && module.exports ? require('./impact-model.js') : (root.TowerDesk || {}).impactModel;
    var api = factory(impactModel);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.messages = api; }
}(typeof self !== 'undefined' ? self : this, function (impactModel) {
    'use strict';

    function hhmm(iso) { var d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function dur(ms) {
        var m = Math.max(1, Math.round(ms / 60000));
        return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    }

    function outageMessage(alert, imp) {
        var lines = ['🔴 ' + alert.deviceName + ' is not responding (' + alert.ip + ')'];
        var s = imp ? impactModel.sentence(imp) : '';
        if (s) lines.push('Affects: ' + s + '.');
        if (imp && imp.sites && imp.sites.length) lines.push('Where: ' + imp.sites.slice(0, 3).join(', '));
        lines.push('Since ' + hhmm(alert.openedAt));
        return lines.join('\n');
    }
    function recoveredMessage(alert, now) {
        return '🟢 ' + alert.deviceName + ' is back online. It was down for ' + dur((now || Date.now()) - Date.parse(alert.openedAt)) + '.';
    }
    function latencyMessage(alert) { return '🟡 ' + alert.message; }

    // For customers, not the team. kind: 'outage' | 'maintenance'. lang: 'ar' | 'en'.
    function customerNotice(lang, kind, opts) {
        opts = opts || {};
        var until = opts.until ? hhmm(opts.until) : '';
        if (lang === 'ar') {
            return kind === 'maintenance'
                ? 'عزيزي المشترك، سنقوم بأعمال صيانة مجدولة على الشبكة في منطقتكم' + (until ? ' حتى الساعة ' + until : '') + '. قد ينقطع الإنترنت لفترة قصيرة. نعتذر عن الإزعاج.'
                : 'عزيزي المشترك، هناك عطل في الشبكة في منطقتكم ونعمل على إصلاحه في أسرع وقت. نعتذر عن الإزعاج.';
        }
        return kind === 'maintenance'
            ? 'Hello, we will be doing planned maintenance on the network in your area' + (until ? ' until ' + until : '') + '. Your internet may be interrupted for a short time. Sorry for the inconvenience.'
            : 'Hello, there is a fault on the network in your area and we are working to fix it as soon as possible. Sorry for the inconvenience.';
    }

    // snap: the /api/monitor answer; attention: the list from insights.attention (or []).
    function statusReport(snap, attention, now) {
        var d = new Date(now || Date.now());
        var devices = (snap && snap.devices) || [];
        var known = devices.filter(function (x) { return x.online !== null && x.online !== undefined && !x.unreachable; });
        var up = known.filter(function (x) { return x.online; }).length;
        var down = known.filter(function (x) { return !x.online; });
        var customers = devices.filter(function (x) { return x.role === 'sector'; }).reduce(function (n, x) { return n + impactModel.customersOf(x); }, 0);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var lines = ['TowerDesk status, ' + String(d.getDate()).padStart(2, '0') + ' ' + months[d.getMonth()] + ' ' + hhmm(d.toISOString()),
            'Devices online: ' + up + ' of ' + known.length + (devices.length > known.length ? ' (' + (devices.length - known.length) + ' unknown)' : '')];
        if (down.length) {
            lines.push('Offline:');
            down.slice(0, 8).forEach(function (x) { var s = impactModel.sentence(impactModel.impact(devices, x.id)); lines.push('• ' + x.name + (s ? ' (' + s + ')' : '')); });
        } else if (known.length) lines.push('Nothing is offline.');
        var att = (attention || []).filter(function (a) { return !down.some(function (x) { return x.id === a.id; }); }).slice(0, 5);
        if (att.length) { lines.push('Needs attention:'); att.forEach(function (a) { lines.push('• ' + a.what + ': ' + a.why); }); }
        lines.push('Customer radios: ' + customers);
        return lines.join('\n');
    }

    // A phone number as WhatsApp wants it: digits only with the country code. 07xx becomes 9647xx for Iraq.
    function normalizePhone(num, cc) {
        var d = String(num || '').replace(/[^\d+]/g, '');
        if (!d) return '';
        d = d.replace(/^\+/, '');
        if (d.indexOf('00') === 0) d = d.slice(2);
        else if (d.indexOf('0') === 0) d = (cc || '964') + d.slice(1);
        return /^\d{8,15}$/.test(d) ? d : '';
    }
    function waLink(num, text, cc) {
        var n = normalizePhone(num, cc);
        return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : '';
    }
    // No number: WhatsApp lets the owner choose who gets the text.
    function waShare(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }

    return { hhmm: hhmm, dur: dur, outageMessage: outageMessage, recoveredMessage: recoveredMessage, latencyMessage: latencyMessage, customerNotice: customerNotice, statusReport: statusReport, normalizePhone: normalizePhone, waLink: waLink, waShare: waShare };
}));
