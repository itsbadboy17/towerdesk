// The Finance page (admin only). Numbers come from /api/finance; prices and costs are saved with
// /api/finance/config. Nothing is sent to anyone: reminders open the owner's own WhatsApp.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.TowerDesk.fmt.esc;
    var FM = window.TowerDesk.financeModel, M = window.TowerDesk.messages;
    var DEMO = !!window.TowerDesk.demo;
    var data = null, cfgDraft = null, saveMsg = '';

    function money(n) { return FM.money(n, data ? data.config.currency : ''); }
    function load() {
        return fetch('/api/finance' + (DEMO ? '?demo=1' : '')).then(function (r) {
            if (r.status === 403) { document.querySelector('.main').innerHTML = '<h1>Finance</h1><p class="muted">Only an admin can open this page.</p>'; return null; }
            return r.ok ? r.json() : null;
        }).then(function (j) { if (j) { data = j; if (!cfgDraft) cfgDraft = JSON.parse(JSON.stringify(j.config)); render(); } })
        .catch(function () { $('k-rev-sub').textContent = 'Could not load'; });
    }

    function bars(rows, key, warn) {
        var max = Math.max.apply(null, rows.map(function (r) { return r[key]; }).concat([1]));
        return rows.map(function (r) {
            return '<div class="bar-row"><span>' + esc(r.label) + (r.sub ? ' <span class="muted">' + esc(r.sub) + '</span>' : '') + '</span><div class="bar' + (warn ? ' warn' : '') + '"><span style="width:' + Math.round((r[key] / max) * 100) + '%"></span></div><span class="val">' + esc(r.text) + '</span></div>';
        }).join('');
    }

    function reminderRow(c) {
        var d = new Date(); d.setDate(d.getDate() + c.days);
        var text = FM.renewalNotice($('fin-lang').value, c.days, d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
        var link = M.waLink(c.phone, text, data.countryCode);
        var when = c.days < 0 ? 'ended ' + (-c.days) + ' day' + (c.days === -1 ? '' : 's') + ' ago' : c.days === 0 ? 'ends today' : 'ends in ' + c.days + ' day' + (c.days === 1 ? '' : 's');
        return '<li><span><strong>' + esc(c.name) + '</strong> <span class="muted">' + esc(c.plan) + ' · ' + esc(when) + (c.price ? ' · ' + esc(money(c.price)) : '') + '</span></span>' +
            (link ? '<a class="btn-secondary btn-sm" target="_blank" rel="noopener" href="' + esc(link) + '">WhatsApp reminder</a>' : '<span class="muted">no phone number</span>') + '</li>';
    }

    function render() {
        var s = data.summary, c = data.config;
        $('fin-demo').hidden = !data.demo;
        var warn = [];
        if (!data.sasConfigured) warn.push('SAS is not connected, so there are no subscribers to work from. Connect it on the SAS page.');
        if (s.unpriced.length) warn.push('No price yet for: ' + s.unpriced.join(', ') + '. Add them under “Prices and costs” below.');
        $('fin-warn').hidden = !warn.length; $('fin-warn').textContent = warn.join(' ');

        $('k-rev').textContent = money(s.revenue); $('k-rev-sub').textContent = 'Active subscribers × plan price';
        $('k-exp').textContent = money(s.expenses); $('k-exp-sub').textContent = c.expenses.length ? c.expenses.length + ' cost' + (c.expenses.length === 1 ? '' : 's') + ' entered' : 'No costs entered yet';
        $('k-profit').textContent = money(s.profit); $('k-profit').className = 'kpi-value ' + (s.profit < 0 ? 'fin-profit-neg' : 'fin-profit-pos'); $('k-profit-sub').textContent = 'Revenue minus costs';
        $('k-active').textContent = s.active; $('k-active-sub').textContent = s.expired + ' ended, ' + s.disabled + ' switched off';
        $('k-ren').textContent = s.expiring7; $('k-ren-sub').textContent = money(s.revenueAt7) + ' at stake';

        $('by-plan').innerHTML = s.plans.length ? bars(s.plans.map(function (p) { return { label: p.plan, sub: p.active + ' × ' + (p.price ? money(p.price) : 'no price'), revenue: p.revenue, text: money(p.revenue) }; }), 'revenue') : '<p class="muted">No subscribers yet.</p>';
        var labels = ['This week', 'Next week', 'In 2 weeks', 'In 3 weeks', 'In 4 weeks'];
        $('weeks').innerHTML = bars(s.weeks.map(function (w, i) { return { label: labels[i], sub: w.count + ' customer' + (w.count === 1 ? '' : 's'), count: w.count, text: money(w.revenue) }; }), 'count', true) +
            '<p class="muted">Customers whose subscription ends in each week, and what they pay. Subscriptions with no end date in SAS are not counted here.</p>';

        var rem = s.expiring.map(reminderRow).join('');
        var lap = s.lapsed.map(reminderRow).join('');
        $('reminders').innerHTML = (rem ? '<h4 class="detail-sec">Ending within 7 days (' + s.expiring.length + ')</h4><ul class="fin-list">' + rem + '</ul>' : '<p class="muted">Nobody is ending in the next 7 days.</p>') +
            (lap ? '<h4 class="detail-sec">Ended in the last 30 days (' + s.lapsed.length + ')</h4><ul class="fin-list">' + lap + '</ul>' : '');

        var h = data.history || [];
        $('trend').innerHTML = h.length < 2 ? '<p class="muted">The trend needs at least two days. TowerDesk saves one point each day you open this page or leave it running.</p>' :
            '<div class="trend-bars" role="img" aria-label="Monthly revenue by day">' + (function () { var max = Math.max.apply(null, h.map(function (p) { return p.revenue; }).concat([1])); return h.slice(-60).map(function (p) { return '<div title="' + esc(p.date + ': ' + money(p.revenue)) + '" style="height:' + Math.max(2, Math.round((p.revenue / max) * 100)) + '%"></div>'; }).join(''); })() + '</div>' +
            '<p class="muted">From ' + esc(h[0].date) + ' to ' + esc(h[h.length - 1].date) + ': monthly revenue went from ' + esc(money(h[0].revenue)) + ' to ' + esc(money(h[h.length - 1].revenue)) + ', active subscribers from ' + h[0].active + ' to ' + h[h.length - 1].active + '.</p>';
        renderCfg();
    }

    function renderCfg() {
        var c = cfgDraft, plans = (data.summary.plans || []).map(function (p) { return p.plan; });
        Object.keys(c.prices).forEach(function (k) { if (plans.indexOf(k) < 0) plans.push(k); });
        var ro = data.demo;
        $('cfg-note').textContent = ro ? 'Demo numbers: changes are not saved' : 'Saved on this computer';
        $('cfg').innerHTML =
            '<div class="form-row"><div class="form-group"><label for="cfg-cur">Currency</label><input type="text" id="cfg-cur" maxlength="5" value="' + esc(c.currency) + '"' + (ro ? ' disabled' : '') + '></div></div>' +
            '<h4 class="detail-sec">Monthly price of each plan</h4><div class="table-wrap"><table class="cfg-table"><tbody>' + (plans.length ? plans.map(function (p) {
                return '<tr><td>' + esc(p) + '</td><td><input type="number" min="0" step="any" inputmode="decimal" data-price="' + esc(p) + '" value="' + (c.prices[p] || '') + '" placeholder="Price per month"' + (ro ? ' disabled' : '') + '></td></tr>';
            }).join('') : '<tr><td class="muted">No plans yet. They appear when SAS is connected.</td></tr>') + '</tbody></table></div>' +
            '<h4 class="detail-sec">Monthly costs</h4><div class="table-wrap"><table class="cfg-table"><tbody>' + c.expenses.map(function (e, i) {
                return '<tr><td><input type="text" data-exp-label="' + i + '" value="' + esc(e.label) + '" maxlength="60" placeholder="What is it, e.g. Bandwidth"' + (ro ? ' disabled' : '') + '></td><td><input type="number" min="0" step="any" data-exp-val="' + i + '" value="' + (e.monthly || '') + '" placeholder="Per month"' + (ro ? ' disabled' : '') + '></td><td>' + (ro ? '' : '<button type="button" class="btn-secondary btn-sm" data-exp-del="' + i + '">Remove</button>') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            (ro ? '' : '<div class="form-actions"><button type="button" class="btn-secondary btn-sm" id="exp-add">Add a cost</button><button type="button" class="btn-primary" id="cfg-save">Save prices and costs</button><span class="muted" id="cfg-msg" role="status">' + esc(saveMsg) + '</span></div>');
    }

    $('cfg').addEventListener('input', function (e) {
        var t = e.target;
        if (t.dataset.price !== undefined) cfgDraft.prices[t.dataset.price] = t.value;
        else if (t.dataset.expLabel !== undefined) cfgDraft.expenses[t.dataset.expLabel].label = t.value;
        else if (t.dataset.expVal !== undefined) cfgDraft.expenses[t.dataset.expVal].monthly = t.value;
        else if (t.id === 'cfg-cur') cfgDraft.currency = t.value;
    });
    $('cfg').addEventListener('click', function (e) {
        if (e.target.id === 'exp-add') { cfgDraft.expenses.push({ label: '', monthly: '' }); renderCfg(); return; }
        if (e.target.dataset.expDel !== undefined) { cfgDraft.expenses.splice(Number(e.target.dataset.expDel), 1); renderCfg(); return; }
        if (e.target.id === 'cfg-save') {
            saveMsg = 'Saving…'; $('cfg-msg').textContent = saveMsg;
            fetch('/api/finance/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfgDraft) })
                .then(function (r) { return r.json(); }).then(function (j) {
                    if (j.error) { saveMsg = j.error; $('cfg-msg').textContent = saveMsg; return; }
                    saveMsg = 'Saved.'; cfgDraft = null; load();
                }).catch(function () { $('cfg-msg').textContent = 'Could not reach TowerDesk.'; });
        }
    });
    $('fin-lang').addEventListener('change', function () { if (data) render(); });
    load();
    setInterval(function () { if (!document.hidden && !document.activeElement.closest('#cfg')) load(); }, 60000);
})();
