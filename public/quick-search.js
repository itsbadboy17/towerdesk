// Quick search: Ctrl+K (or "/") from any page. Finds devices, customers and pages and jumps to them.
// Customers are loaded the first time it opens. Nothing is sent anywhere except the usual TowerDesk calls.
(function () {
    'use strict';
    var esc = window.TowerDesk.fmt.esc;
    var DEMO = !!window.TowerDesk.demo;
    var devices = null, customers = null, overlay = null, items = [], sel = 0;
    var PAGES = [['Overview', '/'], ['Monitoring', '/monitoring'], ['Topology', '/topology'], ['Alerts', '/alerts'], ['Add Device', '/add-device'], ['Set up a device', '/provision'], ['Subscribers (SAS)', '/sas'], ['Finance', '/finance', 'admin'], ['Settings', '/settings', 'admin']];

    function norm(s) { return String(s || '').toLowerCase(); }
    function load() {
        if (!devices) devices = fetch('/api/monitor' + (DEMO ? '?demo=1' : '')).then(function (r) { return r.ok ? r.json() : { devices: [] }; }).then(function (j) { return j.devices || []; }).catch(function () { return []; });
        if (!customers) customers = fetch('/api/radius/subscribers' + (DEMO ? '?demo=1' : '')).then(function (r) { return r.ok ? r.json() : { subscribers: [] }; }).then(function (j) { return j.subscribers || []; }).catch(function () { return []; });
        return Promise.all([devices, customers]);
    }

    function search(q, devs, subs) {
        q = norm(q).trim();
        var out = [];
        var role = window.TowerDesk.role || 'admin';
        var pages = PAGES.filter(function (p) { return (!p[2] || role === 'admin') && (!q || norm(p[0]).indexOf(q) >= 0); }).map(function (p) { return { group: 'Pages', title: p[0], sub: '', href: p[1] }; });
        if (!q) return pages;
        var d = devs.filter(function (x) { return [x.name, x.ip, x.location, x.type].some(function (v) { return norm(v).indexOf(q) >= 0; }); }).slice(0, 8)
            .map(function (x) { return { group: 'Devices', title: x.name, sub: [x.ip, x.location].filter(Boolean).join(' · '), href: '/monitoring?open=' + encodeURIComponent(x.id) + (DEMO ? '&demo=1' : '') }; });
        var c = subs.filter(function (x) { return [x.name, x.username, x.phone, x.mac, x.framedIp, x.plan].some(function (v) { return norm(v).indexOf(q) >= 0; }); }).slice(0, 8)
            .map(function (x) { return { group: 'Customers', title: x.name || x.username, sub: [x.username, x.plan, x.online ? 'online' : 'offline'].filter(Boolean).join(' · '), href: '/topology?trace=' + encodeURIComponent(x.username || x.name) + (DEMO ? '&demo=1' : '') }; });
        return d.concat(c, pages);
    }

    function draw() {
        var list = document.getElementById('qs-list');
        if (!items.length) { list.innerHTML = '<div class="qs-group">Nothing matches. Try a name, an IP address, a username, a phone number or a MAC.</div>'; return; }
        var last = '', html = '';
        items.forEach(function (it, i) {
            if (it.group !== last) { html += '<div class="qs-group">' + esc(it.group) + '</div>'; last = it.group; }
            html += '<div class="qs-item' + (i === sel ? ' on' : '') + '" data-i="' + i + '" role="option"><span>' + esc(it.title) + '</span><span class="qs-sub">' + esc(it.sub) + '</span></div>';
        });
        list.innerHTML = html;
        var on = list.querySelector('.qs-item.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    }
    function run() {
        var q = document.getElementById('qs-input').value;
        load().then(function (r) { items = search(q, r[0], r[1]); sel = 0; draw(); });
    }
    function go(i) { var it = items[i]; if (it) location.href = it.href; }
    function close() { if (overlay) { overlay.remove(); overlay = null; } }
    function open() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.id = 'qs-overlay';
        overlay.innerHTML = '<div id="qs-box" role="dialog" aria-modal="true" aria-label="Quick search"><input id="qs-input" type="text" autocomplete="off" placeholder="Search devices, customers, pages…" aria-label="Search"><div id="qs-list" role="listbox"></div><div id="qs-foot">↑ ↓ to move · Enter to open · Esc to close</div></div>';
        document.body.appendChild(overlay);
        var input = document.getElementById('qs-input');
        input.focus();
        input.addEventListener('input', run);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) { close(); return; } var it = e.target.closest('.qs-item'); if (it) go(Number(it.dataset.i)); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
            else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
        });
        run();
    }

    document.addEventListener('keydown', function (e) {
        var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).nodeName || '') || (document.activeElement && document.activeElement.isContentEditable);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay ? close() : open(); }
        else if (e.key === '/' && !typing && !overlay) { e.preventDefault(); open(); }
        else if (e.key === 'Escape' && overlay) close();
    });
    // A visible way in, next to the language selector.
    var right = document.querySelector('.topbar .right');
    if (right && !document.getElementById('qs-btn')) {
        var b = document.createElement('button');
        b.type = 'button'; b.id = 'qs-btn'; b.className = 'icon-btn'; b.title = 'Search (Ctrl+K)'; b.setAttribute('aria-label', 'Search (Ctrl+K)');
        b.innerHTML = window.TowerDesk.icon ? window.TowerDesk.icon('search') : '🔍';
        b.addEventListener('click', open);
        right.insertBefore(b, right.firstChild);
    }
})();
