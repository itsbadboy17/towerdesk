(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var form = $('device-form');
    var result = $('device-result');
    var methods = {};
    var selectedIds = {}; // device ids ticked for bulk actions (kept across the 10 s reload)

    var HINTS = {
        ping: 'Checks the device is up. No login needed. Good for ONUs and anything you only want to watch.',
        mikrotik: 'RouterOS API (enable it under IP → Services → api). Reads identity, version, CPU and uptime.',
        'mikrotik-ssl': 'RouterOS API over TLS (IP → Services → api-ssl).',
        ssh: 'Logs in over SSH and disconnects. No commands are run.',
        telnet: 'Logs in over Telnet (common on ONUs) and disconnects. No commands are run.',
        snmp: 'Reads the device name, description and uptime with the SNMP community (read-only).',
        snmp1: 'Same as SNMP v2c, for older devices that only speak SNMP v1.',
        tplink: 'Logs in to the TP-Link web page (newer firmware, e.g. Archer AX series) with the router password and reads CPU, RAM and live speed per connected device. Read-only; never kicks you out of the router page.',
        airos: 'Logs in to the Ubiquiti airOS web page (airMAX radios: NanoStation, PowerBeam, Rocket, LiteBeam) and reads the real name, model, signal, CCQ and traffic. Username is usually "ubnt". Read-only.',
        mimosa: 'Logs in to the Mimosa (by Airspan) web page with the device password only — no username — and reads the real name, model, signal, SNR, PHY rate, link name, distance, throughput and the remote end. Usually over HTTP. Read-only.',
        http: 'Opens the web interface to confirm it answers and identify the vendor.',
        https: 'Opens the HTTPS web interface (self-signed certificates are accepted).'
    };
    var TYPE_LABELS = { mikrotik: 'MikroTik', cisco: 'Cisco', ubnt: 'Ubiquiti', mimosa: 'Mimosa', tplink: 'TP-Link', onu: 'ONU', olt: 'OLT', other: 'Other' };

    function esc(v) {
        return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function api(method, url, body) {
        return fetch(url, {
            method: method,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) {
            return r.json().then(function (d) {
                if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
                return d;
            });
        });
    }

    function show(kind, html) {
        result.className = 'result-panel ' + (kind || '');
        result.innerHTML = html;
    }

    function busy(btn, on, label) {
        btn.disabled = on;
        if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
        else if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }

    function details(obj) {
        if (!obj) return '';
        var rows = Object.keys(obj).filter(function (k) { return obj[k] !== undefined && obj[k] !== null && obj[k] !== ''; })
            .map(function (k) { return '<dt>' + esc(k) + '</dt><dd>' + esc(obj[k]) + '</dd>'; });
        return rows.length ? '<dl class="kv">' + rows.join('') + '</dl>' : '';
    }

    function renderTest(t) {
        var head = t.ok
            ? '<p class="result-title ok">✅ ' + esc(t.summary || 'Connected') + '</p>'
            : '<p class="result-title bad">❌ ' + esc(t.error || 'Connection failed') + '</p>';
        var meta = '<p class="muted">' + esc((methods[t.method] || {}).label || t.method) + (t.port ? ' · port ' + esc(t.port) : '') + (t.ms !== undefined ? ' · ' + esc(t.ms) + ' ms' : '') + '</p>';
        var note = t.note ? '<p class="muted">ℹ️ ' + esc(t.note) + '</p>' : '';
        return head + meta + details(t.details) + note;
    }

    // ----- Method-dependent fields -----
    function syncFields() {
        var m = methods[$('device-method').value] || {};
        var key = $('device-method').value;
        document.querySelector('[data-for="login"]').hidden = !m.needsLogin && !/^https?$/.test(key);
        // TP-Link logs in with the password only (the username is always "admin").
        $('device-username').closest('.form-group').hidden = !!m.passwordOnly;
        document.querySelector('[data-for="community"]').hidden = !m.community;
        document.querySelector('[data-for="port"]').hidden = key === 'ping';
        $('device-port').placeholder = m.port ? String(m.port) : 'default';
        $('method-hint').textContent = HINTS[key] || '';
    }

    function readForm() {
        return {
            name: $('device-name').value.trim(),
            type: $('device-type').value,
            ip: $('device-ip').value.trim(),
            location: $('device-location').value.trim(),
            method: $('device-method').value,
            port: $('device-port').value || undefined,
            username: $('device-username').value.trim() || undefined,
            password: $('device-password').value || undefined,
            community: $('device-community').value || undefined
        };
    }

    function needIp() {
        if ($('device-ip').value.trim()) return false;
        show('bad', '<p class="result-title bad">Enter the device IP address first.</p>');
        $('device-ip').focus();
        return true;
    }

    // ----- Auto-detect -----
    $('detect-btn').addEventListener('click', function () {
        if (needIp()) return;
        var btn = this;
        busy(btn, true, 'Detecting…');
        show('', '<p class="muted">Scanning ' + esc($('device-ip').value.trim()) + ' (ping, SSH, Telnet, Web, SNMP, MikroTik)…</p>');
        api('POST', '/api/devices/detect', { ip: $('device-ip').value.trim(), tryVault: true })
            .then(function (d) {
                if (!d.ok) {
                    show('bad', '<p class="result-title bad">❌ Nothing answered at this address.</p><p class="muted">Check the IP, that the device is on, and that your VPN is connected.</p>');
                    return;
                }
                var ports = Object.keys(d.openPorts || {}).map(function (k) { return k + ' (' + d.openPorts[k].port + ')'; });
                if (d.snmp) ports.push('snmp (161)');
                if (d.vendor && !$('device-type').value) $('device-type').value = d.vendor;
                // A saved login that verified wins over the generic suggestion.
                var chosen = (d.matched && d.matched.method) || d.suggestedMethod;
                if (chosen) {
                    $('device-method').value = chosen;
                    $('device-port').value = '';
                    syncFields();
                }
                if (!$('device-name').value && d.snmp && d.snmp.name) $('device-name').value = d.snmp.name;
                if (!$('device-name').value && d.web && d.web.model) $('device-name').value = (TYPE_LABELS[d.vendor] ? TYPE_LABELS[d.vendor] + ' ' : '') + d.web.model;
                show('ok',
                    '<p class="result-title ok">✅ Device found' + (d.vendor ? ': ' + esc(TYPE_LABELS[d.vendor] || d.vendor) : '') + '</p>' +
                    (d.matched ? '<p class="result-title ok">🔑 Saved login "' + esc(d.matched.label) + '" works over ' + esc((methods[d.matched.method] || {}).label || d.matched.method) + '</p>' : '') +
                    details({
                        ping: d.ping && d.ping.alive ? 'replies' + (d.ping.ms !== null ? ' (' + d.ping.ms + ' ms)' : '') : 'no reply',
                        'open services': ports.join(', ') || 'none',
                        model: d.web && d.web.model,
                        firmware: d.web && d.web.firmware,
                        'web page': d.web && d.web.title,
                        'SNMP name': d.snmp && d.snmp.name,
                        'SNMP description': d.snmp && d.snmp.description,
                        'suggested method': chosen ? (methods[chosen] || {}).label : 'none'
                    }) +
                    (d.matched
                        ? '<p class="muted">Press <strong>Add Device</strong> — it will use the saved login.</p>'
                        : '<p class="muted">Fill in the login if needed, then press <strong>Test Connection</strong>.</p>'));
            })
            .catch(function (e) { show('bad', '<p class="result-title bad">❌ ' + esc(e.message) + '</p>'); })
            .then(function () { busy(btn, false); });
    });

    // ----- Test connection -----
    $('test-btn').addEventListener('click', function () {
        if (needIp()) return;
        var btn = this;
        busy(btn, true, 'Testing…');
        show('', '<p class="muted">Connecting…</p>');
        api('POST', '/api/devices/test', readForm())
            .then(function (t) { show(t.ok ? 'ok' : 'bad', renderTest(t)); })
            .catch(function (e) { show('bad', '<p class="result-title bad">❌ ' + esc(e.message) + '</p>'); })
            .then(function () { busy(btn, false); });
    });

    // ----- Save -----
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = $('save-btn');
        busy(btn, true, 'Saving…');
        var payload = readForm();
        payload.tryVault = true; // the server only uses this when no password/community was typed
        api('POST', '/api/devices', payload)
            .then(function (d) {
                show(d.test.ok ? 'ok' : 'warn',
                    '<p class="result-title ' + (d.test.ok ? 'ok' : 'warn') + '">💾 Device added: ' + esc(d.device.name) + ' (' + esc(d.device.ip) + ')</p>' +
                    (d.matched ? '<p class="muted">🔑 Used saved login "' + esc(d.matched) + '".</p>' : '') +
                    (d.test.ok ? '' : '<p class="muted">Saved, but the connection test failed. You can fix the device and press Check later.</p>') +
                    renderTest(d.test));
                form.reset();
                syncFields();
                loadDevices();
            })
            .catch(function (e2) { show('bad', '<p class="result-title bad">❌ ' + esc(e2.message) + '</p>'); })
            .then(function () { busy(btn, false); });
    });
    $('cancel-btn').addEventListener('click', function () {
        setTimeout(syncFields, 0);
        show('', '<p class="muted">Form cleared.</p>');
    });

    // ----- Saved devices -----
    // `live` is this device's entry from the live monitor (readings, online state); without it a
    // device that is reading fine would look like it is still starting.
    function statusBadge(d, live) {
        var st = window.TowerDesk.connState(live ? Object.assign({}, d, { metrics: live.metrics, online: live.online, unreachable: live.unreachable, lastTest: live.lastTest || d.lastTest }) : d);
        var lat = d.status && d.status.online && d.status.latencyMs ? ' · ' + esc(d.status.latencyMs) + ' ms' : '';
        return '<span class="status-badge ' + st.badge + '" title="' + esc(st.hint) + '">● ' + esc(st.label) + lat + '</span>';
    }

    function loadDevices() {
        return Promise.all([api('GET', '/api/devices'), api('GET', '/api/monitor').catch(function () { return { devices: [] }; })]).then(function (r) {
            var list = r[0], liveBy = {};
            (r[1].devices || []).forEach(function (x) { liveBy[x.id] = x; });
            var tbody = $('device-list');
            if (!list.length) {
                tbody.innerHTML = '<tr><td colspan="8" class="muted">No devices yet. Add one above.</td></tr>';
                selectedIds = {};
                updateBulk();
                return;
            }
            // Drop selections for devices that no longer exist.
            var alive = {};
            list.forEach(function (d) { if (selectedIds[d.id]) alive[d.id] = true; });
            selectedIds = alive;
            tbody.innerHTML = list.map(function (d) {
                var failText = { auth: 'Wrong username or password', timeout: 'Timed out: ping works, but the login page did not answer', refused: 'Login service is closed' };
                var last = d.lastTest ? (d.lastTest.ok ? '✅ ' + esc(d.lastTest.summary || 'OK') : '❌ ' + esc(failText[window.TowerDesk.loginProblem(d.lastTest.error)] || d.lastTest.error || 'Failed')) : '—';
                return '<tr data-id="' + esc(d.id) + '">' +
                    '<td class="col-check"><input type="checkbox" class="dev-pick"' + (selectedIds[d.id] ? ' checked' : '') + ' aria-label="Select ' + esc(d.name) + '"></td>' +
                    '<td><button type="button" class="name-btn" data-act="detail" title="Open this device\'s card">' + esc(d.name) + '</button>' + (d.location ? '<div class="muted">' + esc(d.location) + '</div>' : '') + '</td>' +
                    '<td>' + esc(TYPE_LABELS[d.type] || d.type) + '</td>' +
                    '<td><span class="mono">' + esc(d.ip) + (d.port ? ':' + esc(d.port) : '') + '</span></td>' +
                    '<td>' + esc((methods[d.method] || {}).label || d.method) + (d.username ? '<div class="muted">' + esc(d.username) + (d.hasPassword ? ' · 🔒' : '') + '</div>' : '') + '</td>' +
                    '<td>' + statusBadge(d, liveBy[d.id]) + '</td>' +
                    '<td class="last-result">' + last + '</td>' +
                    '<td class="row-actions"><button type="button" class="btn-primary btn-sm" data-act="detail" title="Open the card: connection, ping, advisor">Open</button> <button type="button" class="action-btn" data-act="check" title="Test the connection now">Check</button> ' +
                    '<button type="button" class="btn-secondary btn-sm" data-act="delete">Delete</button></td>' +
                    '</tr>';
            }).join('');
            updateBulk();
        }).catch(function (e) {
            $('device-list').innerHTML = '<tr><td colspan="8">Could not load devices: ' + esc(e.message) + '</td></tr>';
        });
    }

    // ----- Bulk actions (switch many devices to SNMP at once, check, or delete) -----
    function selectedCount() { return Object.keys(selectedIds).length; }

    function updateBulk() {
        var bar = $('bulk-bar');
        if (!bar) return;
        var picks = document.querySelectorAll('#device-list .dev-pick');
        var checked = document.querySelectorAll('#device-list .dev-pick:checked');
        var n = selectedCount();
        bar.hidden = n === 0;
        $('bulk-count').textContent = n + ' selected';
        var all = $('dev-all');
        all.checked = picks.length > 0 && checked.length === picks.length;
        all.indeterminate = checked.length > 0 && checked.length < picks.length;
        var m = methods[$('bulk-method').value] || {};
        $('bulk-community').hidden = !m.community;
    }

    function populateBulkMethods() {
        var sel = $('bulk-method');
        if (!sel || !Object.keys(methods).length) return;
        sel.innerHTML = Object.keys(methods).map(function (k) {
            return '<option value="' + esc(k) + '"' + (k === 'snmp' ? ' selected' : '') + '>' + esc(methods[k].label) + '</option>';
        }).join('');
    }

    // Run an async action over every selected device, one at a time, with progress.
    function bulkRun(label, fn) {
        var ids = Object.keys(selectedIds);
        if (!ids.length) return;
        var done = 0, failed = [];
        [$('bulk-apply'), $('bulk-check'), $('bulk-delete')].forEach(function (b) { b.disabled = true; });
        ids.reduce(function (p, id, i) {
            return p.then(function () {
                $('bulk-status').textContent = label + ' ' + (i + 1) + ' of ' + ids.length + '…';
                return fn(id).then(function () { done++; }, function (err) { failed.push((err && err.message) || 'failed'); });
            });
        }, Promise.resolve()).then(function () {
            [$('bulk-apply'), $('bulk-check'), $('bulk-delete')].forEach(function (b) { b.disabled = false; });
            $('bulk-status').textContent = done + ' done' + (failed.length ? ', ' + failed.length + ' failed' : '');
            return loadDevices();
        });
    }

    $('device-list').addEventListener('change', function (e) {
        var cb = e.target.closest('.dev-pick');
        if (!cb) return;
        var id = cb.closest('tr').dataset.id;
        if (cb.checked) selectedIds[id] = true; else delete selectedIds[id];
        updateBulk();
    });
    $('dev-all').addEventListener('change', function () {
        var on = this.checked;
        document.querySelectorAll('#device-list .dev-pick').forEach(function (cb) {
            cb.checked = on;
            var id = cb.closest('tr').dataset.id;
            if (on) selectedIds[id] = true; else delete selectedIds[id];
        });
        updateBulk();
    });
    $('bulk-method').addEventListener('change', updateBulk);
    $('bulk-apply').addEventListener('click', function () {
        var method = $('bulk-method').value;
        var m = methods[method] || {};
        var community = m.community ? ($('bulk-community').value || undefined) : undefined;
        bulkRun('Switching', function (id) {
            return api('PUT', '/api/devices/' + encodeURIComponent(id), { method: method, community: community, tryVault: true });
        });
    });
    $('bulk-check').addEventListener('click', function () {
        bulkRun('Checking', function (id) { return api('POST', '/api/devices/' + encodeURIComponent(id) + '/check'); });
    });
    $('bulk-delete').addEventListener('click', function () {
        window.TowerDesk.inlineConfirm(this, 'Delete ' + selectedCount() + '?').then(function (yes) {
            if (!yes) return;
            bulkRun('Deleting', function (id) {
                return api('DELETE', '/api/devices/' + encodeURIComponent(id)).then(function () { delete selectedIds[id]; });
            });
        });
    });

    // ----- Device detail + change-monitoring panel -----
    var detailLiveTimer = null;

    function tile(k, v) { return '<div class="stat-tile"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>'; }

    // Orio-style live stat grid built from a device's metrics (signal, CCQ, SNR, rates, …).
    function liveStatsBlock(mx) {
        if (!mx) return '';
        if (mx.error) return '<p class="live-error">⚠️ ' + esc(mx.error) + '</p>';
        var r = mx.radio || {};
        var top = (mx.interfaces && mx.interfaces[0]) || null;
        var t = [];
        var has = function (v) { return v !== undefined && v !== null && v !== ''; };
        if (has(r.signal)) t.push(['Signal', r.signal + ' dBm']);
        if (has(r.snr)) t.push(['SNR', r.snr + ' dB']);
        if (has(r.ccq)) t.push(['CCQ', r.ccq + '%']); else if (has(mx.ccq)) t.push(['CCQ', mx.ccq + '%']);
        if (has(r.txRate)) t.push(['TX rate', r.txRate + ' Mbps']);
        if (has(r.rxRate)) t.push(['RX rate', r.rxRate + ' Mbps']);
        if (top && (has(top.rxBps) || has(top.txBps))) { t.push(['↓ Down', fmtBps(top.rxBps)]); t.push(['↑ Up', fmtBps(top.txBps)]); }
        if (has(r.freq)) t.push(['Frequency', r.freq]);
        if (has(r.chanbw)) t.push(['Channel', r.chanbw + ' MHz']);
        if (has(r.noise)) t.push(['Noise', r.noise + ' dBm']);
        if (has(r.txpower)) t.push(['Tx power', r.txpower + ' dBm']);
        if (has(r.temp)) t.push(['Temp', r.temp + ' °C']);
        if (has(r.phyRate)) t.push(['PHY rate', r.phyRate + ' Mbps']);
        if (has(r.throughput)) t.push(['Throughput', r.throughput + ' Mbps']);
        if (has(r.band)) t.push(['Band', r.band]);
        if (has(r.linkName)) t.push(['Link', r.linkName]);
        if (has(r.distance)) t.push(['Distance', r.distance + ' km']);
        if (has(r.availability)) t.push(['Availability', r.availability + '%']);
        if (has(r.remoteName)) t.push(['Remote end', r.remoteName]);
        if (mx.cpu) t.push(['CPU', mx.cpu.now + '%']);
        if (has(mx.memPct)) t.push(['RAM', mx.memPct + '%']);
        if (has(r.stations)) t.push(['Stations', r.stations]);
        if (has(mx.uptime)) t.push(['Uptime', mx.uptime]);
        if (has(r.essid)) t.push(['SSID', r.essid]);
        if (has(r.mode)) t.push(['Mode', r.mode]);
        if (!t.length) return mx.waiting ? '<p class="muted">📈 Collecting live data (' + esc(mx.source || '') + ')…</p>' : '';
        return '<h4 class="detail-live-h">Live · ' + esc(mx.source || '') + '</h4><div class="stat-grid">' + t.map(function (x) { return tile(x[0], x[1]); }).join('') + '</div>';
    }

    function stopDetailLive() { if (detailLiveTimer) { clearInterval(detailLiveTimer); detailLiveTimer = null; } }

    // Refresh only the live grid (so the edit form the user may be typing in is left alone).
    function refreshDetailLive(id) {
        var box = $('detail-live');
        if (!box) { stopDetailLive(); return; }
        api('GET', '/api/monitor').then(function (data) {
            if (!$('detail-live')) { stopDetailLive(); return; }
            var live = (data.devices || []).find(function (x) { return x.id === id; });
            $('detail-live').innerHTML = liveStatsBlock(live && live.metrics);
        }).catch(function () {});
    }

    function methodOptions(sel) {
        return Object.keys(methods).map(function (k) {
            return '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(methods[k].label) + '</option>';
        }).join('');
    }

    function openDetail(id) {
        show('', '<p class="muted">Loading device…</p>');
        Promise.all([
            api('GET', '/api/devices'),
            api('GET', '/api/monitor').catch(function () { return { devices: [] }; })
        ]).then(function (r) {
            var cfg = r[0].find(function (x) { return x.id === id; });
            if (!cfg) { show('bad', '<p class="result-title bad">Device not found (it may have been removed).</p>'); return; }
            var live = (r[1].devices || []).find(function (x) { return x.id === id; }) || {};
            renderDetail({ cfg: cfg, online: live.online, metrics: live.metrics, lastTest: live.lastTest || cfg.lastTest, others: r[0].filter(function (x) { return x.id !== id; }) });
        }).catch(function (e) { show('bad', '<p class="result-title bad">❌ ' + esc(e.message) + '</p>'); });
    }

    function renderDetail(d) {
        var cfg = d.cfg;
        var st = window.TowerDesk.connState({ online: d.online, lastTest: d.lastTest, method: cfg.method, metrics: d.metrics });
        var det = (d.lastTest && d.lastTest.details) || {};
        var mx = d.metrics;
        var liveLine = '';
        if (mx && !mx.error && !mx.waiting && mx.interfaces && mx.interfaces.length) {
            var top = mx.interfaces[0];
            liveLine = '↓ ' + fmtBps(top.rxBps) + ' · ↑ ' + fmtBps(top.txBps) + (mx.clientCount !== undefined ? ' · ' + mx.clientCount + ' connected' : '');
        }
        var info = details({
            IP: cfg.ip + (cfg.port ? ':' + cfg.port : ''),
            Type: TYPE_LABELS[cfg.type] || cfg.type,
            Provider: cfg.provider,
            Location: cfg.location,
            'Monitoring method': (methods[cfg.method] || {}).label || cfg.method,
            Login: cfg.username ? (cfg.username + (cfg.hasPassword ? ' · 🔒' : '')) : (cfg.hasPassword ? '🔒 saved' : ''),
            'SNMP community': cfg.hasCommunity ? '🔒 saved' : '',
            'Last result': d.lastTest ? (d.lastTest.ok ? '✅ ' + (d.lastTest.summary || 'OK') : '❌ ' + (d.lastTest.error || 'failed')) : '',
            Model: det.model, Firmware: det.firmware, Version: det.version, Uptime: det.uptime,
            'SNMP name': det.name, 'SNMP description': det.description, 'Web server': det.server
        });
        var kind = st.badge === 'healthy' ? 'ok' : (st.badge === 'critical' || st.badge === 'warning' ? 'warn' : '');
        show(kind,
            '<p class="result-title ' + (kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : '') + '">' + esc(cfg.name) + ' — ' + esc(st.label) + '</p>' +
            '<p class="muted">' + esc(st.hint) + '</p>' + info +
            '<div id="detail-live">' + liveStatsBlock(d.metrics) + '</div>' +
            '<form id="edit-form" class="detail-edit" autocomplete="off">' +
                '<h4>Tower details</h4>' +
                '<div class="form-row">' +
                    '<div class="form-group"><label for="edit-provider">Upstream provider</label><input type="text" id="edit-provider" autocomplete="off" placeholder="e.g. HRINS core" value="' + esc(cfg.provider || '') + '"></div>' +
                    '<div class="form-group"><label for="edit-location">Location</label><input type="text" id="edit-location" autocomplete="off" placeholder="e.g. Tower roof" value="' + esc(cfg.location || '') + '"></div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group"><label for="edit-peer">Other end of this link (if you manage it too)</label><select id="edit-peer">' +
                        '<option value="">— Not in TowerDesk (this end only) —</option>' +
                        (d.others || []).map(function (o) { return '<option value="' + esc(o.id) + '"' + (cfg.peerId === o.id ? ' selected' : '') + '>' + esc(o.name) + ' · ' + esc(o.ip) + '</option>'; }).join('') +
                    '</select></div>' +
                '</div>' +
                '<h4>Change how this is monitored</h4>' +
                '<div class="form-row">' +
                    '<div class="form-group"><label for="edit-method">Method</label><select id="edit-method">' + methodOptions(cfg.method) + '</select></div>' +
                    '<div class="form-group" data-edit="port"><label for="edit-port">Port</label><input type="number" id="edit-port" min="1" max="65535" placeholder="default" value="' + esc(cfg.port || '') + '"></div>' +
                '</div>' +
                '<div class="form-row" data-edit="login">' +
                    '<div class="form-group" data-edit="username"><label for="edit-username">Username</label><input type="text" id="edit-username" autocomplete="off" value="' + esc(cfg.username || '') + '"></div>' +
                    '<div class="form-group"><label for="edit-password">Password</label><input type="password" id="edit-password" autocomplete="new-password" placeholder="' + (cfg.hasPassword ? 'leave blank to keep' : '') + '"></div>' +
                '</div>' +
                '<div class="form-row" data-edit="community"><div class="form-group"><label for="edit-community">SNMP community</label><input type="password" id="edit-community" autocomplete="off" placeholder="' + (cfg.hasCommunity ? 'leave blank to keep' : 'public') + '"></div></div>' +
                '<label class="scan-vault-toggle"><input type="checkbox" id="edit-vault" checked> Try my <strong>Saved Logins</strong> / communities for the new method</label>' +
                '<div class="form-actions">' +
                    '<button type="submit" class="btn-primary" id="edit-save">Save &amp; test</button>' +
                    '<button type="button" class="btn-secondary" id="edit-close">Close</button>' +
                '</div>' +
            '</form>');

        var syncEdit = function () {
            var mm = methods[$('edit-method').value] || {};
            var key = $('edit-method').value;
            document.querySelector('[data-edit="login"]').hidden = !mm.needsLogin && !/^https?$/.test(key);
            $('edit-username').closest('.form-group').hidden = !!mm.passwordOnly;
            document.querySelector('[data-edit="community"]').hidden = !mm.community;
            document.querySelector('[data-edit="port"]').hidden = key === 'ping';
            $('edit-port').placeholder = mm.port ? String(mm.port) : 'default';
        };
        $('edit-method').addEventListener('change', syncEdit);
        syncEdit();
        stopDetailLive();
        detailLiveTimer = setInterval(function () { refreshDetailLive(cfg.id); }, 5000);
        $('edit-close').addEventListener('click', function () { stopDetailLive(); show('', '<p class="muted">Closed.</p>'); });
        $('edit-form').addEventListener('submit', function (ev) {
            ev.preventDefault();
            var btn = $('edit-save');
            busy(btn, true, 'Saving…');
            var mm = methods[$('edit-method').value] || {};
            var key = $('edit-method').value;
            var login = mm.needsLogin || /^https?$/.test(key);
            api('PUT', '/api/devices/' + encodeURIComponent(cfg.id), {
                provider: $('edit-provider').value.trim(),
                location: $('edit-location').value.trim(),
                peerId: $('edit-peer').value,
                method: key,
                port: $('edit-port').value || undefined,
                username: login && !mm.passwordOnly ? ($('edit-username').value.trim() || undefined) : undefined,
                password: login ? ($('edit-password').value || undefined) : undefined,
                community: mm.community ? ($('edit-community').value || undefined) : undefined,
                tryVault: $('edit-vault').checked
            }).then(function () { loadDevices(); openDetail(cfg.id); })
              .catch(function (err) { busy(btn, false); show('bad', '<p class="result-title bad">❌ ' + esc(err.message) + '</p>'); });
        });
    }

    function fmtBps(v) {
        if (v === null || v === undefined) return '–';
        var u = ['bps', 'Kbps', 'Mbps', 'Gbps'], i = 0;
        while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
        return (v < 10 && i ? v.toFixed(2) : v < 100 && i ? v.toFixed(1) : Math.round(v)) + ' ' + u[i];
    }

    $('device-list').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var row = btn.closest('tr');
        var id = row.dataset.id;
        var nameEl = row.querySelector('.link-btn') || row.querySelector('strong');
        var name = nameEl ? nameEl.textContent : '';
        if (btn.dataset.act === 'detail') {
            // The device card (connection, ping, advisor) lives on the Monitoring page.
            location.href = '/monitoring?open=' + encodeURIComponent(id);
        } else if (btn.dataset.act === 'delete') {
            window.TowerDesk.inlineConfirm(btn, 'Remove?').then(function (yes) {
                if (!yes) return;
                return api('DELETE', '/api/devices/' + encodeURIComponent(id)).then(function () {
                    show('ok', '<p class="result-title ok">🗑️ Removed "' + esc(name) + '" (nothing was changed on the device).</p>');
                    return loadDevices();
                });
            }).catch(function (err) { show('bad', '<p class="result-title bad">❌ ' + esc(err.message) + '</p>'); });
        } else {
            busy(btn, true, 'Checking…');
            api('POST', '/api/devices/' + encodeURIComponent(id) + '/check')
                .then(function (d) { show(d.test.ok ? 'ok' : 'bad', '<p class="muted">' + esc(name) + '</p>' + renderTest(d.test)); return loadDevices(); })
                .catch(function (err) { show('bad', '<p class="result-title bad">❌ ' + esc(err.message) + '</p>'); busy(btn, false); });
        }
    });

    // ----- Scan a network -----
    var scanJob = null;
    var scanTimer = null;
    var scanRows = {}; // ip -> <tr>, so polling never overwrites what the user edited

    function scanMessage(text) {
        $('scan-status').hidden = false;
        $('scan-status-text').textContent = text;
    }

    function optionList(obj, selected, labelOf) {
        return Object.keys(obj).map(function (k) {
            return '<option value="' + esc(k) + '"' + (k === selected ? ' selected' : '') + '>' + esc(labelOf(k)) + '</option>';
        }).join('');
    }

    function scanRow(f) {
        var tr = document.createElement('tr');
        tr.dataset.ip = f.ip;
        var label = TYPE_LABELS[f.vendor] || '';
        var name = f.name && f.name === f.model && label ? label + ' ' + f.model : (f.name || ((label || 'Device') + ' ' + f.ip));
        var found = [label ? '<strong>' + esc(label) + '</strong>' : '<span class="muted">Unknown vendor</span>']
            .concat(f.model ? [esc(f.model) + (f.firmware ? ' · fw ' + esc(f.firmware) : '')] : [])
            .concat(f.description ? ['<span class="muted">' + esc(f.description) + '</span>'] : [])
            .concat(['<span class="muted">' + esc((f.services || []).join(', ') || (f.pingMs !== null ? 'ping only' : '')) + (f.pingMs !== null && f.pingMs !== undefined ? ' · ' + esc(f.pingMs) + ' ms' : '') + '</span>'])
            .concat(f.existing ? ['<span class="status-badge warning">Already added as "' + esc(f.existing) + '"</span>'] : []);
        tr.innerHTML =
            '<td><input type="checkbox" class="scan-pick" aria-label="Select ' + esc(f.ip) + '"' + (f.existing ? '' : ' checked') + '></td>' +
            '<td><span class="mono">' + esc(f.ip) + '</span></td>' +
            '<td><input type="text" class="scan-name" maxlength="80" value="' + esc(name) + '" aria-label="Name for ' + esc(f.ip) + '"></td>' +
            '<td><select class="scan-type" aria-label="Type for ' + esc(f.ip) + '">' + optionList(TYPE_LABELS, f.vendor || 'other', function (k) { return TYPE_LABELS[k]; }) + '</select></td>' +
            '<td><select class="scan-method" aria-label="Connection method for ' + esc(f.ip) + '">' + optionList(methods, f.suggestedMethod || 'ping', function (k) { return methods[k].label; }) + '</select></td>' +
            '<td class="scan-found">' + found.join('<br>') + '</td>';
        return tr;
    }

    function renderScan(job) {
        var tbody = $('scan-list');
        job.found.forEach(function (f) {
            if (scanRows[f.ip]) return;
            var tr = scanRow(f);
            scanRows[f.ip] = tr;
            // Keep rows in IP order as they arrive.
            var next = Array.prototype.find.call(tbody.children, function (r) { return ipNum(r.dataset.ip) > ipNum(f.ip); });
            tbody.insertBefore(tr, next || null);
        });
        $('scan-results').hidden = job.found.length === 0;
        $('scan-progress').max = job.total || 1;
        $('scan-progress').value = job.scanned;
        var running = job.status === 'running';
        scanMessage((running ? 'Scanning ' + job.range + ': ' + job.scanned + ' of ' + job.total + ' addresses · ' : (job.status === 'stopped' ? 'Stopped · ' : 'Done · ')) +
            job.found.length + ' device' + (job.found.length === 1 ? '' : 's') + ' found' +
            (!running && !job.found.length ? '. Nothing answered: check the range and that your VPN is connected.' : ''));
        $('scan-btn').hidden = running;
        $('scan-stop-btn').hidden = !running;
        if (!running) { clearInterval(scanTimer); scanTimer = null; }
    }

    function ipNum(ip) {
        return String(ip).split('.').reduce(function (n, o) { return n * 256 + Number(o); }, 0);
    }

    function pollScan() {
        if (!scanJob) return;
        api('GET', '/api/discovery/' + encodeURIComponent(scanJob))
            .then(renderScan)
            .catch(function (e) { scanMessage('❌ ' + e.message); clearInterval(scanTimer); scanTimer = null; $('scan-btn').hidden = false; $('scan-stop-btn').hidden = true; });
    }

    $('scan-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var range = $('scan-range').value.trim();
        if (!range) { scanMessage('Enter an IP range first, for example 192.168.1.0/24.'); $('scan-range').focus(); return; }
        api('POST', '/api/discovery', { range: range, community: $('scan-community').value || undefined })
            .then(function (job) {
                scanJob = job.id;
                scanRows = {};
                $('scan-list').innerHTML = '';
                $('scan-all').checked = false;
                renderScan(job);
                clearInterval(scanTimer);
                scanTimer = setInterval(pollScan, 1500);
            })
            .catch(function (err) { scanMessage('❌ ' + err.message); });
    });

    $('scan-stop-btn').addEventListener('click', function () {
        if (!scanJob) return;
        api('POST', '/api/discovery/' + encodeURIComponent(scanJob) + '/stop').then(renderScan).catch(function () {});
    });

    $('scan-all').addEventListener('change', function () {
        var on = this.checked;
        Array.prototype.forEach.call(document.querySelectorAll('#scan-list .scan-pick:not(:disabled)'), function (c) { c.checked = on; });
    });

    $('scan-add-btn').addEventListener('click', function () {
        var rows = Array.prototype.filter.call(document.querySelectorAll('#scan-list tr'), function (tr) {
            var c = tr.querySelector('.scan-pick');
            return c && c.checked && !c.disabled;
        });
        if (!rows.length) { scanMessage('Tick the devices you want to add first.'); return; }
        var btn = this;
        var useVault = $('scan-use-vault').checked;
        var username = $('scan-username').value.trim() || undefined;
        var password = $('scan-password').value || undefined;
        var community = $('scan-community').value || undefined;
        var typed = !!(username || password || community);
        var added = 0, failed = [];
        busy(btn, true, 'Adding…');
        rows.reduce(function (p, tr, i) {
            return p.then(function () {
                var method = tr.querySelector('.scan-method').value;
                var m = methods[method] || {};
                var login = m.needsLogin || /^https?$/.test(method);
                scanMessage('Adding ' + (i + 1) + ' of ' + rows.length + ' (' + tr.dataset.ip + ')' + (useVault && !typed ? ', trying saved logins…' : '…'));
                return api('POST', '/api/devices', {
                    name: tr.querySelector('.scan-name').value.trim() || tr.dataset.ip,
                    type: tr.querySelector('.scan-type').value,
                    ip: tr.dataset.ip,
                    method: method,
                    username: typed && login && !m.passwordOnly ? username : undefined,
                    password: typed && login ? password : undefined,
                    community: typed && m.community ? community : undefined,
                    tryVault: useVault && !typed
                }).then(function (res) {
                    added++;
                    var c = tr.querySelector('.scan-pick');
                    c.checked = false;
                    c.disabled = true;
                    var badge = res.matched ? '🔑 Added with "' + esc(res.matched) + '"' : 'Added';
                    tr.querySelector('.scan-found').insertAdjacentHTML('beforeend', '<br><span class="status-badge healthy">' + badge + '</span>');
                }).catch(function (err) { failed.push(tr.dataset.ip + ': ' + err.message); });
            });
        }, Promise.resolve()).then(function () {
            busy(btn, false);
            $('scan-password').value = '';
            scanMessage('➕ Added ' + added + ' device' + (added === 1 ? '' : 's') + '.' + (failed.length ? ' Not added: ' + failed.join('; ') : ''));
            loadDevices();
        });
    });

    // Coming from Topology ("seen on your network, not added"): start with what is already known.
    (function prefill() {
        try {
            var q = new URLSearchParams(location.search);
            var nm = q.get('name'), ip = q.get('ip'), ty = q.get('type');
            if (!nm && !ip && !ty) return;
            if (nm && $('device-name')) $('device-name').value = nm.slice(0, 80);
            if (ip && $('device-ip')) $('device-ip').value = ip.slice(0, 45);
            if (ty && $('device-type') && Array.prototype.some.call($('device-type').options, function (o) { return o.value === ty; })) $('device-type').value = ty;
            var f = !ip && $('device-ip') ? $('device-ip') : $('device-name');
            if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); }
        } catch (e) { /* prefill is only a convenience */ }
    })();

    // ----- Saved Logins (credential vault) -----
    function syncVaultFields() {
        var community = $('vault-kind').value === 'community';
        document.querySelector('[data-vault="username"]').hidden = community;
        document.querySelector('[data-vault="password"]').hidden = community;
        document.querySelector('[data-vault="community"]').hidden = !community;
        $('vault-add-btn').textContent = community ? '➕ Save community' : '➕ Save login';
    }

    function renderVault(v) {
        var chips = [];
        (v.logins || []).forEach(function (l) {
            chips.push('<span class="vault-chip" data-id="' + esc(l.id) + '"><span class="vault-kind">login</span> ' + esc(l.label) + (l.username ? ' <span class="muted">(' + esc(l.username) + ')</span>' : '') + ' <button type="button" aria-label="Remove ' + esc(l.label) + '">✕</button></span>');
        });
        (v.communities || []).forEach(function (c) {
            chips.push('<span class="vault-chip" data-id="' + esc(c.id) + '"><span class="vault-kind">snmp</span> ' + esc(c.label) + ' <button type="button" aria-label="Remove ' + esc(c.label) + '">✕</button></span>');
        });
        $('vault-list').innerHTML = chips.length ? chips.join('') : '<span class="vault-empty">No saved logins yet. Add the ones you use most.</span>';
    }

    function loadVault() {
        return api('GET', '/api/credentials').then(renderVault).catch(function () {});
    }

    $('vault-kind').addEventListener('change', syncVaultFields);
    $('vault-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var kind = $('vault-kind').value;
        var body = { kind: kind, label: $('vault-label').value.trim() };
        if (kind === 'community') {
            if (!$('vault-community').value) { $('vault-community').focus(); return; }
            body.community = $('vault-community').value;
        } else {
            if (!$('vault-password').value) { $('vault-password').focus(); return; }
            body.username = $('vault-username').value.trim();
            body.password = $('vault-password').value;
        }
        var btn = $('vault-add-btn');
        busy(btn, true, 'Saving…');
        api('POST', '/api/credentials', body)
            .then(function () { $('vault-form').reset(); syncVaultFields(); return loadVault(); })
            .catch(function (err) { show('bad', '<p class="result-title bad">❌ ' + esc(err.message) + '</p>'); })
            .then(function () { busy(btn, false); });
    });
    $('vault-list').addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var chip = btn.closest('.vault-chip');
        window.TowerDesk.inlineConfirm(btn, 'Remove?').then(function (yes) {
            if (!yes) return;
            return api('DELETE', '/api/credentials/' + encodeURIComponent(chip.dataset.id)).then(loadVault);
        }).catch(function () {});
    });

    // ----- Fix unconnected: auto-try the vault on every device that isn't connected yet -----
    $('autoconnect-btn').addEventListener('click', function () {
        var btn = this;
        busy(btn, true, 'Trying…');
        show('', '<p class="muted">Trying your saved logins &amp; SNMP communities on every device that isn\'t connected yet… this can take a moment.</p>');
        api('POST', '/api/devices/autoconnect')
            .then(function (r) {
                if (r.note) { show('warn', '<p class="result-title warn">🔧 ' + esc(r.note) + '</p>'); return; }
                var ok = r.results.filter(function (x) { return x.connected; })
                    .map(function (x) { return '✅ ' + esc(x.name) + ' → ' + esc((methods[x.method] || {}).label || x.method) + (x.label ? ' as "' + esc(x.label) + '"' : ''); });
                var still = r.checked - r.connected;
                show(r.connected ? 'ok' : 'warn',
                    '<p class="result-title ' + (r.connected ? 'ok' : 'warn') + '">🔧 Connected ' + r.connected + ' of ' + r.checked + ' unconnected device' + (r.checked === 1 ? '' : 's') + '.</p>' +
                    (ok.length ? '<p class="muted">' + ok.join('<br>') + '</p>' : '') +
                    (still ? '<p class="muted">' + still + ' still not connected' + (r.noCommunities ? ' — add an <strong>SNMP community</strong> under Saved Logins to reach Mimosa / Ubiquiti radios, then run this again.' : ' — open each to set the right login or method.') + '</p>' : '') +
                    (!r.checked ? '<p class="muted">Every device is already connected. 🎉</p>' : ''));
                loadDevices();
            })
            .catch(function (e) { show('bad', '<p class="result-title bad">❌ ' + esc(e.message) + '</p>'); })
            .then(function () { busy(btn, false); });
    });

    $('device-method').addEventListener('change', function () { $('device-port').value = ''; syncFields(); });

    api('GET', '/api/devices/methods')
        .then(function (m) { methods = m; })
        .catch(function () { /* keep defaults */ })
        .then(function () { syncFields(); syncVaultFields(); populateBulkMethods(); loadDevices(); loadVault(); });
    setInterval(function () {
        // Don't redraw while a confirmation is open or a bulk selection is in progress.
        if (!document.querySelector('.inline-confirm') && selectedCount() === 0) loadDevices();
    }, 10000);
})();
