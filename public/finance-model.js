// Money, worked out from the subscriber list and the plan prices the owner typed in. Pure functions shared by
// the page and the server (tested in Node). SAS does not report payments, so these are ESTIMATES:
// "what the active subscribers should pay each month", not "what was collected".
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.financeModel = api; }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var DAY = 86400000;
    function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function parseDate(v) {
        if (!v) return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
        var t = Date.parse(v);
        return isNaN(t) ? null : startOfDay(t);
    }
    function price(cfg, plan) { var p = Number(((cfg && cfg.prices) || {})[plan]); return p > 0 ? p : 0; }

    // subs: [{ plan, enabled, expiration, name, username, phone }]
    // cfg:  { prices: { plan: monthlyPrice }, expenses: [{ label, monthly }] }
    function compute(subs, cfg, now) {
        now = now || Date.now();
        var today = startOfDay(now);
        var plans = {}, expiring = [], lapsed = [];
        var s = { active: 0, expired: 0, disabled: 0, revenue: 0, expiring7: 0, expiring30: 0, revenueAt7: 0, revenueAt30: 0, lapsedRevenue: 0, unpriced: [] };
        var weeks = [0, 1, 2, 3, 4].map(function (i) { return { from: i * 7, to: i * 7 + 6, count: 0, revenue: 0 }; });
        (subs || []).forEach(function (u) {
            var plan = u.plan || 'Unknown';
            var p = price(cfg, plan);
            var slot = plans[plan] || (plans[plan] = { plan: plan, price: p, active: 0, revenue: 0, expired: 0 });
            var exp = parseDate(u.expiration);
            var days = exp === null ? null : Math.round((exp - today) / DAY);
            if (u.enabled === false) { s.disabled++; return; }
            if (days !== null && days < 0) {
                s.expired++; slot.expired++; s.lapsedRevenue += p;
                if (days >= -30) lapsed.push({ name: u.name || u.username, username: u.username, phone: u.phone || '', plan: plan, days: days, price: p });
                return;
            }
            s.active++; slot.active++; slot.revenue += p; s.revenue += p;
            if (days !== null) {
                if (days <= 30) { s.expiring30++; s.revenueAt30 += p; }
                if (days <= 7) { s.expiring7++; s.revenueAt7 += p; expiring.push({ name: u.name || u.username, username: u.username, phone: u.phone || '', plan: plan, days: days, price: p }); }
                weeks.forEach(function (w) { if (days >= w.from && days <= w.to) { w.count++; w.revenue += p; } });
            }
        });
        Object.keys(plans).forEach(function (k) { if (!plans[k].price && plans[k].active) s.unpriced.push(k); });
        var expenses = ((cfg && cfg.expenses) || []).reduce(function (n, e) { return n + (Number(e.monthly) > 0 ? Number(e.monthly) : 0); }, 0);
        s.expenses = expenses;
        s.profit = s.revenue - expenses;
        s.plans = Object.keys(plans).map(function (k) { return plans[k]; }).sort(function (a, b) { return b.revenue - a.revenue || b.active - a.active; });
        s.weeks = weeks;
        s.expiring = expiring.sort(function (a, b) { return a.days - b.days; });
        s.lapsed = lapsed.sort(function (a, b) { return b.days - a.days; });
        return s;
    }

    // Text for a customer whose subscription ends soon (or just ended). lang: 'ar' | 'en'.
    function renewalNotice(lang, days, dateText) {
        var when = days < 0 ? (lang === 'ar' ? 'انتهى اشتراككم' : 'Your subscription has ended') : days === 0 ? (lang === 'ar' ? 'ينتهي اشتراككم اليوم' : 'Your subscription ends today') : (lang === 'ar' ? 'ينتهي اشتراككم بعد ' + days + ' يوم' : 'Your subscription ends in ' + days + ' day' + (days === 1 ? '' : 's'));
        return lang === 'ar'
            ? 'عزيزي المشترك، ' + when + (dateText ? ' (' + dateText + ')' : '') + '. للتجديد يرجى التواصل معنا. شكراً لاختياركم لنا.'
            : 'Hello, ' + when.charAt(0).toLowerCase() + when.slice(1) + (dateText ? ' (' + dateText + ')' : '') + '. Please contact us to renew. Thank you for choosing us.';
    }

    function money(n, currency) {
        var v = Math.round(Number(n) || 0);
        return v.toLocaleString('en-US') + (currency ? ' ' + currency : '');
    }

    return { compute: compute, renewalNotice: renewalNotice, money: money, parseDate: parseDate };
}));
