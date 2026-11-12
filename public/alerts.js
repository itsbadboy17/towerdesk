(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };

    function esc(v) {
        return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function dur(from, to) {
        var s = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 1000));
        if (s < 60) return s + 's';
        if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
        if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
        return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
    }
    function when(iso) {
        var d = new Date(iso);
        var today = new Date().toDateString() === d.toDateString();
        return today ? d.toLocaleTimeString() : d.toLocaleString();
    }
    function sev(s) {
        return s === 'critical' ? '<span class="status-badge critical">● Critical</span>' : '<span class="status-badge warning">● Warning</span>';
    }

    function render(data) {
        var s = data.summary;
        $('kpi-active').textContent = s.active;
        $('kpi-critical').textContent = s.critical;
        $('kpi-warning').textContent = s.warning;
        $('kpi-resolved').textContent = s.resolved24h;
        $('kpi-active-sub').textContent = s.active ? (s.unacknowledged + ' not acknowledged') : 'All clear';
        $('kpi-warning-sub').textContent = 'Latency ≥ ' + data.latencyWarnMs + ' ms';

        var open = data.alerts.filter(function (a) { return !a.resolvedAt; });
        var closed = data.alerts.filter(function (a) { return a.resolvedAt; }).slice(0, 50);

        $('active-list').innerHTML = open.length ? open.map(function (a) {
            return '<tr data-id="' + esc(a.id) + '" class="' + (a.acknowledgedAt ? 'acked' : '') + '">' +
                '<td><span class="mono">' + esc(when(a.openedAt)) + '</span></td>' +
                '<td>' + esc(a.deviceName) + '<div class="muted mono">' + esc(a.ip) + '</div></td>' +
                '<td>' + sev(a.severity) + '</td>' +
                '<td>' + esc(a.message) + '</td>' +
                '<td><span class="mono">' + dur(a.openedAt) + '</span></td>' +
                '<td>' + (a.acknowledgedAt
                    ? '<span class="muted">✔ Acknowledged</span>'
                    : '<button type="button" class="action-btn" data-act="ack">Acknowledge</button>') + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="6" class="muted">✅ No active alerts. Devices that stop responding show up here within seconds.</td></tr>';

        $('history-list').innerHTML = closed.length ? closed.map(function (a) {
            return '<tr>' +
                '<td><span class="mono">' + esc(when(a.openedAt)) + '</span></td>' +
                '<td>' + esc(a.deviceName) + '<div class="muted mono">' + esc(a.ip) + '</div></td>' +
                '<td>' + sev(a.severity) + '</td>' +
                '<td>' + esc(a.message) + '</td>' +
                '<td><span class="mono">' + dur(a.openedAt, a.resolvedAt) + '</span></td>' +
                '<td>' + esc(a.resolution || 'Resolved') + '</td>' +
                '</tr>';
        }).join('') : '<tr><td colspan="6" class="muted">No resolved alerts yet.</td></tr>';
    }

    function load() {
        return fetch('/api/alerts').then(function (r) {
            if (r.status === 401) { location.href = '/login?next=/alerts'; throw new Error('login'); }
            return r.json();
        }).then(render).catch(function () { /* retry on next poll */ });
    }

    $('active-list').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act="ack"]');
        if (!btn) return;
        btn.disabled = true;
        var id = btn.closest('tr').dataset.id;
        fetch('/api/alerts/' + encodeURIComponent(id) + '/ack', { method: 'POST' }).then(load);
    });

    // Desktop notifications (handled by app.js on every page once allowed).
    var notifyBtn = $('notify-btn');
    function syncNotifyBtn() {
        if (!('Notification' in window)) { notifyBtn.textContent = '🔕 Notifications not supported'; notifyBtn.disabled = true; return; }
        if (!window.isSecureContext) { notifyBtn.textContent = '🔕 Notifications need localhost or HTTPS'; notifyBtn.disabled = true; return; }
        var p = Notification.permission;
        notifyBtn.textContent = p === 'granted' ? '🔔 Desktop notifications on' : (p === 'denied' ? '🔕 Notifications blocked in browser' : '🔔 Enable desktop notifications');
        notifyBtn.disabled = p !== 'default';
    }
    notifyBtn.addEventListener('click', function () {
        if (!('Notification' in window) || Notification.permission !== 'default') return;
        Notification.requestPermission().then(syncNotifyBtn);
    });
    syncNotifyBtn();

    load();
    setInterval(function () { if (!document.hidden) load(); }, 10000);
})();
