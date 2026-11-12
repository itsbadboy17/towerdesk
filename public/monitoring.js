(function () {
    'use strict';

    var POLL_MS = 5000;
    var TYPE_LABELS = { mikrotik: 'MikroTik', cisco: 'Cisco', ubnt: 'Ubiquiti', mimosa: 'Mimosa', tplink: 'TP-Link', onu: 'ONU', other: 'Device' };
    var DEMO = location.search.indexOf('demo') >= 0 || (function () { try { return localStorage.getItem('td-demo') === '1'; } catch (e) { return false; } })();
    var MON_URL = DEMO ? '/api/monitor?demo=1' : '/api/monitor';
    var selectedProvider = (function () { try { return localStorage.getItem('td-provider') || 'all'; } catch (e) { return 'all'; } })();
    var $ = function (id) { return document.getElementById(id); };
    var lastOk = 0;

    function esc(v) {
        return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function ago(iso) {
        if (!iso) return '';
        var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
        if (s < 60) return s + 's';
        if (s < 3600) return Math.floor(s / 60) + 'm';
        if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
        return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
    }

    function ms(v) {
        if (v === null || v === undefined) return '–';
        if (v < 1) return '<1 ms';
        return (v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)) + ' ms';
    }

    // Latency sparkline: gaps (offline samples) are drawn as red ticks on the baseline.
    function sparkline(history) {
        var W = 240, H = 48, pad = 3;
        if (!history || !history.length) return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"></svg>';
        var vals = history.filter(function (v) { return v !== null; });
        var max = Math.max(5, Math.max.apply(null, vals.length ? vals : [5]));
        var step = (W - pad * 2) / Math.max(1, 59);
        var x0 = W - pad - (history.length - 1) * step;
        var path = '', area = '', down = '', pen = false, segStart = null;
        history.forEach(function (v, i) {
            var x = (x0 + i * step).toFixed(1);
            if (v === null) {
                if (pen) { area += 'L' + segStart.last + ',' + (H - pad) + 'Z'; }
                pen = false;
                down += '<line x1="' + x + '" x2="' + x + '" y1="' + (H - pad - 6) + '" y2="' + (H - pad) + '" class="spark-down"/>';
                return;
            }
            var y = (H - pad - (v / max) * (H - pad * 2 - 4)).toFixed(1);
            if (!pen) { path += 'M' + x + ',' + y; area += 'M' + x + ',' + (H - pad) + 'L' + x + ',' + y; segStart = { first: x }; }
            else { path += 'L' + x + ',' + y; area += 'L' + x + ',' + y; }
            segStart.last = x;
            pen = true;
        });
        if (pen) area += 'L' + segStart.last + ',' + (H - pad) + 'Z';
        return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
            '<path class="spark-area" d="' + area + '"/><path class="spark-line" d="' + path + '"/>' + down + '</svg>';
    }

    function bps(v) {
        if (v === null || v === undefined) return '–';
        var u = ['bps', 'Kbps', 'Mbps', 'Gbps'];
        var i = 0;
        while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
        return (v < 10 && i ? v.toFixed(2) : v < 100 && i ? v.toFixed(1) : Math.round(v)) + ' ' + u[i];
    }

    // RX/TX traffic chart for one interface (last 10 minutes).
    function trafficChart(rx, tx) {
        var W = 520, H = 120, padL = 4, padR = 4, padT = 14, padB = 4;
        var all = rx.concat(tx).filter(function (v) { return v !== null; });
        var max = Math.max(1000, Math.max.apply(null, all.length ? all : [0]));
        var step = (W - padL - padR) / 59;
        var n = Math.max(rx.length, tx.length);
        var x0 = W - padR - (n - 1) * step;
        function line(arr) {
            var d = '', pen = false;
            arr.forEach(function (v, i) {
                if (v === null) { pen = false; return; }
                var x = (x0 + i * step).toFixed(1);
                var y = (H - padB - (v / max) * (H - padT - padB)).toFixed(1);
                d += (pen ? 'L' : 'M') + x + ',' + y;
                pen = true;
            });
            return d;
        }
        function area(arr) {
            var d = line(arr);
            if (!d) return '';
            var firstX = d.match(/^M([\d.]+)/)[1];
            var lastX = d.match(/([\d.]+),[\d.]+$/)[1];
            return d + 'L' + lastX + ',' + (H - padB) + 'L' + firstX + ',' + (H - padB) + 'Z';
        }
        return '<svg class="traffic-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Traffic, peak ' + esc(bps(max)) + '">' +
            '<line x1="0" x2="' + W + '" y1="' + padT + '" y2="' + padT + '" class="grid"/>' +
            '<line x1="0" x2="' + W + '" y1="' + ((H + padT) / 2) + '" y2="' + ((H + padT) / 2) + '" class="grid"/>' +
            '<path class="rx-area" d="' + area(rx) + '"/><path class="rx-line" d="' + line(rx) + '"/>' +
            '<path class="tx-line" d="' + line(tx) + '"/>' +
            '</svg><div class="chart-scale muted">peak ' + esc(bps(max)) + '</div>';
    }

    function metricsBlock(m) {
        if (!m) return '<p class="muted live-info">📈 Traffic graphs need the <strong>MikroTik API</strong>, <strong>SNMP</strong> or <strong>TP-Link router login</strong> method (or a TP-Link with its password saved).</p>';
        if (m.error) return '<p class="live-error">⚠️ ' + esc(m.error) + '</p>';
        if (m.waiting || !m.interfaces.length) return '<p class="muted live-info">📈 Collecting traffic data (' + esc(m.source) + ')…</p>';
        var top = m.interfaces[0];
        var sys = [];
        if (m.signal !== null && m.signal !== undefined) sys.push('signal <strong>' + esc(m.signal) + ' dBm</strong>');
        if (m.ccq !== null && m.ccq !== undefined) sys.push('CCQ <strong>' + esc(m.ccq) + '%</strong>');
        if (m.cpu) sys.push('CPU <strong>' + esc(m.cpu.now) + '%</strong>');
        if (m.memPct !== null && m.memPct !== undefined) sys.push('RAM <strong>' + esc(m.memPct) + '%</strong>');
        if (m.uptime) sys.push('up ' + esc(m.uptime));
        return '<div class="traffic">' +
            '<div class="traffic-head"><span><strong>' + esc(top.name) + '</strong> <span class="muted">· ' + esc(m.source) + '</span></span>' +
            '<span class="legend"><span class="rx">↓ ' + esc(bps(top.rxBps)) + '</span><span class="tx">↑ ' + esc(bps(top.txBps)) + '</span></span></div>' +
            trafficChart(top.rx, top.tx) +
            (m.kind === 'clients'
                ? (m.clients && m.clients.length
                    ? '<table class="iface-table"><thead><tr><th>Device (' + esc(m.clientCount) + ' online)</th><th>↓ Down</th><th>↑ Up</th></tr></thead><tbody>' +
                      m.clients.map(function (c) {
                          return '<tr><td>' + esc(c.name) + '<div class="muted mono">' + esc(c.ip || '') + (c.link ? ' · ' + esc(c.link) : '') + '</div></td><td class="mono">' + esc(bps(c.rxBps)) + '</td><td class="mono">' + esc(bps(c.txBps)) + '</td></tr>';
                      }).join('') + '</tbody></table>'
                    : '<p class="muted">No devices connected right now.</p>')
                : '<table class="iface-table"><thead><tr><th>Interface</th><th>↓ RX</th><th>↑ TX</th></tr></thead><tbody>' +
                  m.interfaces.map(function (i) {
                      return '<tr class="' + (i.up ? '' : 'down') + '"><td>' + (i.up ? '🟢' : '⚫') + ' ' + esc(i.name) + '</td><td class="mono">' + esc(bps(i.rxBps)) + '</td><td class="mono">' + esc(bps(i.txBps)) + '</td></tr>';
                  }).join('') + '</tbody></table>') +
            (sys.length ? '<p class="muted">' + sys.join(' · ') + '</p>' : '') +
            '</div>';
    }

    // Compact card — a few key numbers; click opens the full detail.
    function card(d) {
        var state = d.online === true ? 'online' : (d.online === false ? 'offline' : 'unknown');
        var cs = window.TowerDesk.connState(d);
        var det = (d.lastTest && d.lastTest.details) || {};
        var mx = d.metrics || {};
        var r = mx.radio || {};
        var keys = [];
        if (r.signal != null) keys.push(['Signal', r.signal + ' dBm']);
        if (mx.ccq != null) keys.push(['CCQ', mx.ccq + '%']);
        if (mx.clientCount != null) keys.push(['Clients', mx.clientCount]);
        if (!keys.length) { keys.push(['Now', ms(d.latencyMs)]); keys.push(['Uptime', d.uptimePct === null ? '–' : d.uptimePct + '%']); }
        var top = mx.interfaces && mx.interfaces[0];
        if (top && top.rxBps != null && keys.length < 4) keys.push(['Traffic', bps(top.rxBps)]);
        keys.push([state === 'offline' ? 'Down' : 'Up', d.since ? ago(d.since) : '–']);
        var statline = keys.slice(0, 4).map(function (k) { return '<div><dt>' + esc(k[0]) + '</dt><dd>' + esc(k[1]) + '</dd></div>'; }).join('');
        return '<article class="live-card compact ' + state + '" data-id="' + esc(d.id) + '" tabindex="0" role="button">' +
            '<header class="live-card-head">' +
                '<div><h4>' + esc(d.name) + (d.role === 'sector' ? ' <span class="role-chip">Sector</span>' : '') + '</h4><div class="muted mono">' + esc(d.ip) + ' · ' + esc(det.model || TYPE_LABELS[d.type] || d.type) + '</div></div>' +
                '<span class="status-badge ' + cs.badge + '" title="' + esc(cs.hint) + '">● ' + esc(cs.label) + '</span>' +
            '</header>' +
            sparkline(d.history) +
            '<dl class="live-stats">' + statline + '</dl>' +
            '<div class="card-more"><span>Open details</span><i>›</i></div>' +
            '</article>';
    }

    // A point-to-point backhaul shown as one master↔slave unit. The managed device is the slave
    // (at the tower); the master is read from its remote-end data (or a paired device later).
    function bhEnd(icon, name, sub, mono) {
        return '<div class="bh-end"><span class="bh-ic">' + (window.TowerDesk.icon ? window.TowerDesk.icon(icon) : '') + '</span>' +
            '<div class="bh-name">' + esc(name) + '</div><div class="muted">' + esc(sub) + '</div>' +
            (mono ? '<div class="muted mono">' + esc(mono) + '</div>' : '') + '</div>';
    }
    function backhaulCard(d) {
        var state = d.online === true ? 'online' : (d.online === false ? 'offline' : 'unknown');
        var mx = d.metrics || {};
        var r = mx.radio || {};
        var det = (d.lastTest && d.lastTest.details) || {};
        var masterName = r.remoteName || det.remote || 'Upstream';
        var signalTxt = r.signal != null ? (r.signal + ' dBm') : (det.signal || '');
        var linkTxt = r.linkName || det.link || '';
        var cap = (r.throughput != null && r.rxRate) ? Math.round((r.throughput / r.rxRate) * 100) : null;
        var cell = function (k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; };
        var strip = '';
        if (r.throughput != null) strip += cell('Traffic', r.throughput + ' Mb/s');
        if (r.signal != null) strip += cell('Signal', r.signal + ' dBm');
        if (r.snr != null) strip += cell('SNR', r.snr + ' dB');
        if (r.txRate != null || r.rxRate != null) strip += cell('PHY tx/rx', (r.txRate || '–') + '/' + (r.rxRate || '–'));
        if (cap != null) strip += cell('Capacity', cap + '%');
        strip += cell(state === 'offline' ? 'Down for' : 'Up for', d.since ? ago(d.since) : '–');
        var mid = '<div class="bh-mid"><div class="bh-state ' + (state === 'online' ? 'ok' : state) + '">' +
            (state === 'offline' ? 'link down' : (state === 'online' ? 'connected' : 'checking…')) + '</div>' +
            '<div class="bh-wire ' + state + '"></div>' +
            '<div class="muted">' + esc([linkTxt, r.freq, signalTxt].filter(Boolean).join(' · ')) + '</div></div>';
        return '<article class="backhaul-card ' + state + '" data-id="' + esc(d.id) + '" tabindex="0" role="button">' +
            '<div class="bh-link">' +
                bhEnd('remote', masterName, 'Master' + (r.remoteModel ? ' · ' + r.remoteModel : ' · at provider'), '') +
                mid +
                bhEnd('monitoring', d.name, 'Slave · ' + (det.model || TYPE_LABELS[d.type] || d.type), d.ip) +
            '</div>' +
            '<dl class="bh-stats">' + strip + '</dl>' +
            '<div class="card-more"><span>Open details</span><i>›</i></div>' +
            '</article>';
    }

    // ----- Full device/sector/backhaul detail (click a card) -----
    var lastData = null, detailId = null;

    function statGrid(d) {
        var mx = d.metrics || {};
        var r = mx.radio || {};
        var has = function (v) { return v !== undefined && v !== null && v !== ''; };
        var t = [];
        if (has(r.signal)) t.push(['Signal', r.signal + ' dBm']);
        if (has(r.snr)) t.push(['SNR', r.snr + ' dB']);
        if (has(mx.ccq) || has(r.ccq)) t.push(['CCQ', (has(r.ccq) ? r.ccq : mx.ccq) + '%']);
        if (has(r.noise)) t.push(['Noise', r.noise + ' dBm']);
        if (has(r.txRate) || has(r.rxRate)) t.push(['PHY tx/rx', (r.txRate || '–') + '/' + (r.rxRate || '–')]);
        var top = mx.interfaces && mx.interfaces[0];
        if (top && has(top.rxBps)) { t.push(['↓ Down', bps(top.rxBps)]); t.push(['↑ Up', bps(top.txBps)]); }
        if (has(r.freq)) t.push(['Frequency', r.freq]);
        if (has(r.chanbw)) t.push(['Channel', r.chanbw + ' MHz']);
        if (has(r.txpower)) t.push(['Tx power', r.txpower + ' dBm']);
        if (has(r.temp)) t.push(['Temp', r.temp + ' °C']);
        if (has(r.distance)) t.push(['Distance', r.distance + ' km']);
        if (has(r.availability)) t.push(['Availability', r.availability + '%']);
        if (has(r.remoteName)) t.push(['Remote end', r.remoteName]);
        if (mx.cpu) t.push(['CPU', mx.cpu.now + '%']);
        if (has(mx.memPct)) t.push(['RAM', mx.memPct + '%']);
        if (has(mx.stationCount)) t.push(['Clients', mx.stationCount]);
        t.push(['Latency', ms(d.latencyMs)]);
        t.push(['Avg latency', ms(d.avgLatencyMs)]);
        t.push(['Uptime', d.uptimePct === null ? '–' : d.uptimePct + '%']);
        if (has(mx.uptime)) t.push(['Up for', mx.uptime]);
        return '<div class="stat-grid">' + t.map(function (x) {
            return '<div class="stat-tile"><div class="k">' + esc(x[0]) + '</div><div class="v">' + esc(x[1]) + '</div></div>';
        }).join('') + '</div>';
    }

    // ----- Wide two-ended view for a backhaul link -----
    // A dish on a mast, drawn facing right; the far end is mirrored with CSS so the two face
    // each other. Colours come from the theme (currentColor + accent).
    function dishArt() {
        return '<svg class="link-art" viewBox="0 0 120 110" aria-hidden="true">' +
            '<path class="la-mast" d="M52 104V46M40 104h24M46 104l6-22 6 22"/>' +
            '<path class="la-dish" d="M58 14c-16 8-22 26-12 44 4 7 10 12 16 14z"/>' +
            '<path class="la-arm" d="M52 46l22-6M46 30l28 10"/><circle class="la-feed" cx="76" cy="40" r="4"/>' +
            '<path class="la-wave" d="M88 28c5 7 5 17 0 24M98 20c9 12 9 28 0 40"/>' +
            '</svg>';
    }
    function linkEnd(side, title, sub, mono, rows) {
        return '<section class="link-end ' + side + '">' + dishArt() +
            '<div class="link-end-name">' + esc(title) + '</div><div class="muted">' + esc(sub) + '</div>' +
            (mono ? '<div class="muted mono">' + esc(mono) + '</div>' : '') +
            '<dl class="link-end-data">' + rows.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
            '</section>';
    }
    // The managed radio reports both directions of the link, so each end shows the direction it
    // transmits: the far end sends what this radio receives (RX), this end sends its TX. The far
    // end's own signal/CCQ appear only when the radio reports them.
    function linkHero(d) {
        var state = d.online === true ? 'online' : (d.online === false ? 'offline' : 'unknown');
        var mx = d.metrics || {};
        var r = mx.radio || {};
        var det = (d.lastTest && d.lastTest.details) || {};
        var top = mx.interfaces && mx.interfaces[0];
        var has = function (v) { return v !== undefined && v !== null && v !== ''; };
        var ccq = has(r.ccq) ? r.ccq : mx.ccq;
        var far = [], near = [];
        if (has(r.remoteSignal)) far.push(['Signal', r.remoteSignal + ' dBm']);
        if (has(r.remoteCcq)) far.push(['CCQ', r.remoteCcq + '%']);
        if (has(r.rxRate)) far.push(['Rate', r.rxRate + ' Mbps']);
        if (top && has(top.rxBps)) far.push(['Traffic sent', bps(top.rxBps)]);
        if (has(r.signal)) near.push(['Signal', r.signal + ' dBm']);
        if (has(r.snr)) near.push(['SNR', r.snr + ' dB']);
        if (has(ccq)) near.push(['CCQ', ccq + '%']);
        if (has(r.txRate)) near.push(['Rate', r.txRate + ' Mbps']);
        if (top && has(top.txBps)) near.push(['Traffic sent', bps(top.txBps)]);
        if (has(r.txpower)) near.push(['Tx power', r.txpower + ' dBm']);
        if (!far.length) far.push(['Data', 'Not reported']);
        var facts = [r.linkName || det.link, r.freq, has(r.chanbw) ? r.chanbw + ' MHz' : '', has(r.distance) ? r.distance + ' km' : ''].filter(Boolean);
        var total = top && has(top.rxBps) ? bps((top.rxBps || 0) + (top.txBps || 0)) : (has(r.throughput) ? r.throughput + ' Mb/s' : '');
        return '<div class="link-hero ' + state + '">' +
            linkEnd('far', r.remoteName || det.remote || 'Upstream', 'Far end' + (r.remoteModel ? ' · ' + r.remoteModel : ''), '', far) +
            '<div class="link-mid">' +
                '<div class="bh-state ' + (state === 'online' ? 'ok' : state) + '">' + (state === 'offline' ? 'link down' : (state === 'online' ? 'connected' : 'checking…')) + '</div>' +
                '<div class="link-beam ' + state + '"><span></span></div>' +
                (total ? '<div class="link-total">' + esc(total) + '</div><div class="muted">total traffic</div>' : '') +
                '<div class="muted link-facts">' + esc(facts.join(' · ')) + '</div>' +
            '</div>' +
            linkEnd('near', d.name, 'This end · ' + (det.model || TYPE_LABELS[d.type] || d.type), d.ip, near) +
            '</div>';
    }

    function detailBody(d) {
        var cs = window.TowerDesk.connState(d);
        var det = (d.lastTest && d.lastTest.details) || {};
        var roleLabel = { backhaul: 'Backhaul link', sector: 'Sector (PtMP)', device: 'Device' }[d.role] || 'Device';
        var info = [
            ['IP', d.ip + (d.port ? ':' + d.port : '')],
            ['Type', TYPE_LABELS[d.type] || d.type],
            ['Role', roleLabel],
            ['Connected via', d.method],
            ['Model', det.model],
            ['Firmware', det.firmware || (det.version ? 'v' + det.version : '')],
            ['Last result', d.lastTest ? (d.lastTest.ok ? '✓ ' + (d.lastTest.summary || 'OK') : '✗ ' + (d.lastTest.error || 'failed')) : '']
        ].filter(function (x) { return x[1]; });
        return '<div class="detail-top">' +
                '<div><h3>' + esc(d.name) + '</h3><div class="muted mono">' + esc(d.ip) + ' · ' + esc(roleLabel) + '</div></div>' +
                '<span class="status-badge ' + cs.badge + '">● ' + esc(cs.label) + '</span>' +
            '</div>' +
            (d.role === 'backhaul' ? linkHero(d) : '') +
            '<dl class="kv detail-kv">' + info.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
            '<h4 class="detail-sec">Live</h4>' + statGrid(d) +
            '<h4 class="detail-sec">Latency (10 min)</h4>' + sparkline(d.history) +
            (d.online === false ? '' : '<h4 class="detail-sec">Traffic &amp; ' + (d.metrics && d.metrics.kind === 'clients' ? 'clients' : 'interfaces') + '</h4>' + metricsBlock(d.metrics));
    }

    function ensureModal() {
        var m = document.getElementById('detail-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'detail-modal';
        m.className = 'modal-overlay';
        m.innerHTML = '<div class="modal detail-modal"><div class="modal-header"><strong>Device detail</strong><button class="close-btn" aria-label="Close">×</button></div><div class="modal-body" id="detail-modal-body"></div></div>';
        document.body.appendChild(m);
        m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.close-btn')) closeDetail(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
        return m;
    }
    function openDetail(id) {
        if (!lastData) return;
        var d = lastData.devices.find(function (x) { return x.id === id; });
        if (!d) return;
        detailId = id;
        var m = ensureModal();
        var isLink = d.role === 'backhaul';
        m.querySelector('.detail-modal').classList.toggle('wide', isLink);
        m.querySelector('.modal-header strong').textContent = isLink ? 'Link detail' : 'Device detail';
        document.getElementById('detail-modal-body').innerHTML = detailBody(d);
        m.style.display = 'flex';
    }
    function closeDetail() {
        detailId = null;
        var m = document.getElementById('detail-modal');
        if (m) m.style.display = 'none';
    }

    function provKey(d) { return d.provider || 'Unassigned'; }
    function renderProviderTabs(devices) {
        var el = document.getElementById('provider-tabs');
        if (!el) return;
        var counts = {};
        devices.forEach(function (d) { if (d.provider) counts[d.provider] = (counts[d.provider] || 0) + 1; });
        var providers = Object.keys(counts).sort();
        var unassigned = devices.filter(function (d) { return !d.provider; }).length;
        if (!providers.length || (providers.length === 1 && !unassigned)) { el.hidden = true; return; }
        el.hidden = false;
        var valid = ['all'].concat(providers); if (unassigned) valid.push('Unassigned');
        if (valid.indexOf(selectedProvider) < 0) selectedProvider = 'all';
        var tab = function (key, label, n) { return '<button class="provider-tab' + (selectedProvider === key ? ' active' : '') + '" data-prov="' + esc(key) + '">' + esc(label) + '<span class="pt-count">' + n + '</span></button>'; };
        var html = tab('all', 'All providers', devices.length);
        providers.forEach(function (p) { html += tab(p, p, counts[p]); });
        if (unassigned) html += tab('Unassigned', 'Unassigned', unassigned);
        el.innerHTML = html;
    }

    function render(data) {
        lastData = data;
        renderProviderTabs(data.devices);
        var shown = selectedProvider === 'all' ? data.devices : data.devices.filter(function (d) { return provKey(d) === selectedProvider; });
        var s = { total: shown.length, online: shown.filter(function (d) { return d.online === true; }).length, offline: shown.filter(function (d) { return d.online === false; }).length };
        var sectors = shown.filter(function (d) { return d.role === 'sector'; });
        var subs = sectors.reduce(function (a, d) { var m = d.metrics || {}; return a + (m.clientCount || m.stationCount || 0); }, 0);
        var trafficBps = shown.reduce(function (a, d) {
            if (!d.online) return a;
            var ifs = (d.metrics && d.metrics.interfaces) || [];
            return a + ifs.reduce(function (b, i) { return b + (i.rxBps || 0) + (i.txBps || 0); }, 0);
        }, 0);
        $('kpi-total').textContent = s.total;
        $('kpi-online').textContent = s.online;
        $('kpi-offline').textContent = s.offline;
        $('kpi-traffic').textContent = bps(trafficBps);
        $('kpi-sectors').textContent = sectors.length;
        $('kpi-subs').textContent = subs;
        $('kpi-sectors-sub').textContent = sectors.length ? sectors.filter(function (d) { return d.online; }).length + ' online' : 'PtMP access points';
        $('kpi-online-sub').textContent = s.total ? Math.round((s.online / s.total) * 100) + '% of devices' : ' ';
        $('kpi-offline-sub').textContent = s.offline ? 'Needs attention' : ' ';
        $('interval-note').textContent = 'Checked every ' + Math.round(data.intervalMs / 1000) + ' s · last 10 minutes shown';

        var grid = $('live-grid');
        if (!shown.length) {
            grid.innerHTML = '<div class="empty-state"><p><strong>No devices yet.</strong></p><p class="muted">Add your router, ONU or tower equipment and it will show up here live.</p><a class="btn-primary" href="/add-device">➕ Add Device</a></div>';
        } else {
            // Offline first, then by name.
            var list = shown.slice().sort(function (a, b) {
                return (a.online === false ? 0 : 1) - (b.online === false ? 0 : 1) || a.name.localeCompare(b.name);
            });
            var backhaul = list.filter(function (x) { return x.role === 'backhaul'; });
            var rest = list.filter(function (x) { return x.role !== 'backhaul'; });
            var html = '';
            if (backhaul.length) html += '<div class="monitor-section-label">Backhaul links</div>' + backhaul.map(backhaulCard).join('');
            if (rest.length) html += (backhaul.length ? '<div class="monitor-section-label">Sectors &amp; devices</div>' : '') + rest.map(card).join('');
            grid.innerHTML = html;
        }

        if (detailId) {
            var dd = data.devices.find(function (x) { return x.id === detailId; });
            if (dd) { var body = document.getElementById('detail-modal-body'); if (body) body.innerHTML = detailBody(dd); }
            else closeDetail();
        }

        var ev = $('event-list');
        ev.innerHTML = data.events.length ? data.events.map(function (e) {
            return '<tr><td><span class="mono">' + esc(new Date(e.t).toLocaleTimeString()) + '</span></td>' +
                '<td>' + esc(e.name) + '</td><td><span class="mono">' + esc(e.ip) + '</span></td>' +
                '<td>' + (e.online ? '<span class="status-badge healthy">● Came online</span>' : '<span class="status-badge critical">● Went offline</span>') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="muted">No events yet. Status changes will appear here.</td></tr>';
    }

    function setLive(ok, text) {
        $('live-pill').className = 'live-pill ' + (ok ? 'ok' : 'bad');
        $('live-text').textContent = text;
    }

    function poll() {
        fetch(MON_URL)
            .then(function (r) {
                if (r.status === 401) { location.href = '/login?next=/monitoring'; throw new Error('login'); }
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                lastOk = Date.now();
                render(data);
                setLive(true, 'Live');
            })
            .catch(function (e) {
                if (e.message !== 'login') setLive(false, 'Disconnected — retrying');
            });
    }

    // Keep the "Live · updated Xs ago" text fresh between polls.
    setInterval(function () {
        if (lastOk && Date.now() - lastOk < POLL_MS * 3) setLive(true, 'Live · updated ' + Math.round((Date.now() - lastOk) / 1000) + 's ago');
    }, 1000);

    var grid = document.getElementById('live-grid');
    if (grid) {
        grid.addEventListener('click', function (e) {
            var cardEl = e.target.closest('.live-card, .backhaul-card');
            if (cardEl && cardEl.dataset.id) openDetail(cardEl.dataset.id);
        });
        grid.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var cardEl = e.target.closest('.live-card, .backhaul-card');
            if (cardEl && cardEl.dataset.id) { e.preventDefault(); openDetail(cardEl.dataset.id); }
        });
    }

    var ptabs = document.getElementById('provider-tabs');
    if (ptabs) {
        ptabs.addEventListener('click', function (e) {
            var btn = e.target.closest('.provider-tab');
            if (!btn || !btn.dataset.prov) return;
            selectedProvider = btn.dataset.prov;
            try { localStorage.setItem('td-provider', selectedProvider); } catch (err) { }
            if (lastData) render(lastData);
        });
    }

    poll();
    setInterval(function () { if (!document.hidden) poll(); }, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
})();
