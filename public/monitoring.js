(function () {
    'use strict';

    var POLL_MS = 5000;
    var TYPE_LABELS = { mikrotik: 'MikroTik', cisco: 'Cisco', ubnt: 'Ubiquiti', mimosa: 'Mimosa', tplink: 'TP-Link', onu: 'ONU', olt: 'OLT', other: 'Device' };
    var DEMO = location.search.indexOf('demo') >= 0 || (function () { try { return localStorage.getItem('td-demo') === '1'; } catch (e) { return false; } })();
    var MON_URL = DEMO ? '/api/monitor?demo=1' : '/api/monitor';
    var selectedProvider = (function () { try { return localStorage.getItem('td-provider') || 'all'; } catch (e) { return 'all'; } })();
    var $ = function (id) { return document.getElementById(id); };
    var I = window.TowerDesk.insights;
    var lastOk = 0;
    var openOnLoad = (/[?&]open=([^&]+)/.exec(location.search) || [])[1];
    if (openOnLoad) openOnLoad = decodeURIComponent(openOnLoad);

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
            (m.kind === 'stations' && m.interfaces.length < 2 ? ''
            : m.kind === 'clients'
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

    // ----- Sector registration table (the CPE radios connected to an access point) -----
    // SAS/RADIUS sessions are matched to stations by MAC address: when the customer's PPPoE user
    // is dialled on the CPE radio itself, the MAC the sector sees is the one SAS records.
    var sas = { byMac: {}, loadedAt: 0, configured: false, loading: false };
    var macKey = I.macKey;
    function loadSas() {
        if (sas.loading || Date.now() - sas.loadedAt < 30000) return;
        sas.loading = true;
        fetch('/api/radius/subscribers' + (DEMO ? '?demo=1' : ''))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                sas.loading = false; sas.loadedAt = Date.now();
                if (!j) return;
                sas.configured = !!j.configured;
                sas.byMac = {};
                // The server traces each subscriber to its station (exact MAC, or one step off when
                // unambiguous), so index by the station's MAC.
                (j.subscribers || []).forEach(function (s) { var k = s.station ? I.staKey(s.station) : ''; if (k) sas.byMac[k] = s; });
                if (detailId && lastData) {
                    var dd = lastData.devices.find(function (x) { return x.id === detailId; });
                    var body = document.getElementById('detail-modal-body');
                    if (dd && (dd.role === 'sector' || hasList(dd)) && body && !detailBusy(body)) body.innerHTML = detailBody(dd);
                }
            })
            .catch(function () { sas.loading = false; sas.loadedAt = Date.now(); });
    }
    // A sector's stations or an OLT's ONUs: both are "the customers on this device".
    function hasList(d) { var k = d && d.metrics && d.metrics.kind; return k === 'stations' || k === 'onus'; }
    // Do not redraw the card under the user: an open ping result, a history chart, or the ONU
    // search box while it is being typed in.
    function detailBusy(body) {
        return !!body.querySelector('.net-tools-out:not([hidden]), .sta-history, .adv-open') || !!(document.activeElement && document.activeElement.id === 'onu-filter');
    }

    // ----- OLT: the ONU table (optical power, temperature) -----
    var onuFilter = '';
    function onuLevel(v) { return v == null ? '' : (v <= I.ATT.onuRx ? ' lvl-bad' : (v <= I.ATT.onuRx + 2 ? ' lvl-warn' : '')); }
    function onuRows(m) {
        var q = onuFilter.trim().toLowerCase();
        var rows = (m && m.onus) || [];
        if (q) rows = rows.filter(function (c) {
            var s = sas.byMac[I.staKey(c)];
            return [c.name, c.port, c.serial, c.mac, s && s.username].some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
        });
        if (!rows.length) return '<tr><td colspan="8" class="muted">No ONU matches.</td></tr>';
        return rows.map(function (c) {
            var s = sas.byMac[I.staKey(c)];
            var user = s
                ? '<strong>' + esc(s.username) + '</strong><div class="muted">' + esc(s.plan || '') + (s.online === false ? ' · session offline' : '') + (s.station && s.station.byName ? ' · matched by name' : '') + '</div>'
                : '<span class="muted">' + (sas.configured ? 'Not in SAS' : '—') + '</span>';
            var id = c.serial || c.mac || '–';
            var hasMac = macKey(c.mac).length === 12;
            return '<tr class="' + (c.online === false ? 'down' : '') + (hasMac ? ' row-click' : '') + '"' + (hasMac ? ' data-sta-mac="' + esc(c.mac) + '" tabindex="0" title="Show the optical power history of this ONU"' : '') + '>' +
                '<td>' + (c.online === false ? '⚫ ' : '🟢 ') + esc(c.name || c.port || id) + (c.name && c.port ? '<div class="muted mono">' + esc(c.port) + '</div>' : '') + '</td>' +
                '<td class="mono">' + esc(id) + '</td>' +
                '<td>' + user + '</td>' +
                '<td class="mono' + onuLevel(c.signal) + '">' + (c.signal != null ? esc(c.signal) + ' dBm' : '–') + '</td>' +
                '<td class="mono">' + (c.txPower != null ? esc(c.txPower) + ' dBm' : '–') + '</td>' +
                '<td class="mono' + onuLevel(c.oltRx) + '">' + (c.oltRx != null ? esc(c.oltRx) + ' dBm' : '–') + '</td>' +
                '<td class="mono' + (c.temp != null && c.temp >= I.ATT.onuTemp ? ' lvl-bad' : '') + '">' + (c.temp != null ? esc(c.temp) + ' °C' : '–') + '</td>' +
                '<td class="mono">' + (c.distance != null ? esc(c.distance) + ' m' : '–') + '</td></tr>';
        }).join('');
    }
    function onuBlock(m) {
        var all = (m && m.onus) || [];
        if (!all.length) return '<p class="muted">No ONUs registered on this OLT right now.</p>';
        var matched = all.filter(function (c) { return sas.byMac[I.staKey(c)]; }).length;
        var weak = all.filter(function (c) { return c.online !== false && c.signal != null && c.signal <= I.ATT.onuRx; }).length;
        var note = sas.configured
            ? matched + ' matched to a SAS user'
            : 'Connect your SAS server on the SAS page to see the PPPoE user of each ONU.';
        return '<p class="muted reg-note">' + esc(m.onuCount) + ' ONUs · ' + esc(m.onuOnline) + ' online' + (weak ? ' · <span class="lvl-bad">' + weak + ' with weak light</span>' : '') + ' · ' + esc(note) +
                (m.onuCount > all.length ? ' · showing the ' + all.length + ' weakest' : '') +
                ' <button type="button" class="link-btn" data-export-onu>Export to Excel</button></p>' +
            '<input type="search" id="onu-filter" class="onu-filter" placeholder="Search name, user, serial or MAC" aria-label="Search ONUs" value="' + esc(onuFilter) + '">' +
            '<div class="reg-wrap"><table class="iface-table reg-table"><thead><tr><th>ONU</th><th>Serial / MAC</th><th>SAS user</th><th>Rx power</th><th>Tx power</th><th>Rx at OLT</th><th>Temp</th><th>Distance</th></tr></thead><tbody id="onu-rows">' +
            onuRows(m) + '</tbody></table></div>';
    }
    function exportOnus(id) {
        var d = lastData && lastData.devices.find(function (x) { return x.id === id; });
        var rows = (d && d.metrics && d.metrics.onus) || [];
        window.TowerDesk.exportCsv('onus-' + String(d ? d.name : 'olt').replace(/[^\w-]+/g, '_') + '.csv',
            ['OLT', 'ONU', 'Port', 'Serial', 'MAC', 'SAS user', 'Plan', 'Online', 'Rx power dBm', 'Tx power dBm', 'Rx at OLT dBm', 'Temp C', 'Distance m'],
            rows.map(function (c) {
                var s = sas.byMac[I.staKey(c)] || {};
                return [d.name, c.name, c.port, c.serial, c.mac, s.username, s.plan, c.online === false ? 'no' : 'yes', c.signal, c.txPower, c.oltRx, c.temp, c.distance];
            }));
    }

    // ----- Sector advisor: diagnose, propose, and apply only what the owner accepts -----
    var adv = { id: null, busy: false, data: null, error: null, msg: '', pf: null };
    function advQ() { return DEMO ? '?demo=1' : ''; }
    function advPost(path, body) {
        return fetch('/api/advisor/' + encodeURIComponent(detailId) + path + advQ(), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
        }).then(function (r) { return r.json(); });
    }
    function advRedraw() {
        var el = document.getElementById('adv-panel');
        var d = lastData && lastData.devices.find(function (x) { return x.id === detailId; });
        if (el && d) el.outerHTML = advisorBlock(d);
    }
    function advRun(useAi) {
        adv = { id: detailId, busy: true, data: adv.id === detailId ? adv.data : null, error: null, msg: useAi ? 'Asking the AI…' : 'Checking…' };
        advRedraw();
        advPost('', { ai: !!useAi, lang: document.documentElement.lang === 'ar' ? 'ar' : 'en' }).then(function (j) {
            adv.busy = false; adv.msg = '';
            if (j.error) adv.error = j.error; else adv.data = j;
            advRedraw();
        }).catch(function () { adv.busy = false; adv.msg = ''; adv.error = 'Could not reach TowerDesk.'; advRedraw(); });
    }
    // Read-only: log in to the radio and check it can take a one-click change. Changes nothing.
    function advPreflight() {
        adv.busy = true; adv.error = null; adv.msg = 'Checking the radio…'; adv.pf = null; advRedraw();
        advPost('/preflight').then(function (j) {
            adv.busy = false; adv.msg = '';
            adv.pf = { ok: !!j.ok, problems: j.problems || [], frequency: j.frequency, txPower: j.txPower, sample: !!j.sample };
            advRedraw();
        }).catch(function () { adv.busy = false; adv.msg = ''; adv.error = 'Could not reach TowerDesk.'; advRedraw(); });
    }
    function advApply() {
        var boxes = document.querySelectorAll('#adv-panel input[data-adv-change]:checked');
        var accept = Array.prototype.map.call(boxes, function (b) { return Number(b.dataset.advChange); });
        if (!accept.length) { adv.error = 'Tick at least one change first.'; advRedraw(); return; }
        var list = accept.map(function (i) { var c = adv.data.changes[i]; return c.label + ' ' + (c.from == null ? '?' : c.from) + ' → ' + c.to + ' ' + c.unit; }).join(', ');
        var btn = document.getElementById('adv-apply');
        window.TowerDesk.inlineConfirm(btn, 'Change this live sector now? ' + list + '. Clients may drop for about a minute.').then(function (yes) {
            if (!yes) return;
            adv.busy = true; adv.error = null; adv.msg = 'Applying…'; advRedraw();
            advPost('/apply', { proposalId: adv.data.proposalId, accept: accept }).then(function (j) {
                adv.busy = false; adv.msg = '';
                if (j.error) adv.error = j.error;
                else { adv.data.pending = j.pending; adv.data.changes = []; adv.data.proposalId = null; }
                advRedraw();
            }).catch(function () { adv.busy = false; adv.msg = ''; adv.error = 'Lost contact while applying. The radio puts the old values back by itself in a few minutes.'; advRedraw(); });
        });
    }
    function advFinish(action) {
        adv.busy = true; adv.error = null; adv.msg = action === 'keep' ? 'Keeping…' : 'Undoing…'; advRedraw();
        advPost('/' + action).then(function (j) {
            adv.busy = false;
            if (j.error) { adv.error = j.error; adv.msg = ''; }
            else { adv.data.pending = null; adv.msg = action === 'keep' ? 'Kept. The new values stay.' : 'Undone. The old values are back.'; }
            advRedraw();
        }).catch(function () { adv.busy = false; adv.msg = ''; adv.error = 'Could not reach the radio. It puts the old values back by itself.'; advRedraw(); });
    }
    function advisorBlock(d) {
        var mine = adv.id === d.id;
        var a = mine ? adv.data : null;
        var h = '<div id="adv-panel" class="adv-panel' + (mine && (a || adv.busy || adv.error) ? ' adv-open' : '') + '">';
        h += '<div class="adv-actions"><button type="button" class="btn-secondary btn-sm" data-adv="check"' + (adv.busy ? ' disabled' : '') + '>Check this sector</button>' +
            '<button type="button" class="btn-primary btn-sm" data-adv="ai"' + (adv.busy ? ' disabled' : '') + '>Ask AI for advice</button>' +
            (mine && adv.msg ? '<span class="muted" role="status">' + esc(adv.msg) + '</span>' : '') + '</div>';
        if (mine && adv.error) h += '<p class="live-error">⚠️ ' + esc(adv.error) + '</p>';
        var pf = mine ? adv.pf : null;
        if (!a) return h + '<p class="muted adv-hint">The check reads this sector\'s live data and points at likely causes. AI advice is optional and needs a key in Settings.</p></div>';
        h += '<ul class="adv-findings">' + a.findings.map(function (f) { return '<li class="adv-' + esc(f.severity) + '">' + esc(f.text) + '</li>'; }).join('') + '</ul>';
        if (a.aiError) h += '<p class="live-error">⚠️ ' + esc(a.aiError) + '</p>';
        if (a.ai) {
            h += '<div class="adv-ai"><div class="adv-ai-head"><strong>AI advice</strong> <span class="muted">confidence: ' + esc(a.ai.confidence) + ' · sent ' + esc(a.sent.clients) + ' clients and ' + esc(a.sent.otherRadios) + ' radios, no names or addresses</span></div>' +
                '<p>' + esc(a.ai.summary) + '</p>' +
                (a.ai.causes.length ? '<h5>Likely causes</h5><ul>' + a.ai.causes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
                (a.ai.manual.length ? '<h5>To do by hand</h5><ul>' + a.ai.manual.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
        }
        if (a.pending && !a.pending.expired) {
            h += '<div class="adv-pending"><strong>Changed just now:</strong> ' + a.pending.applied.map(function (c) { return esc(c.label) + ' ' + esc(c.from == null ? '?' : c.from) + ' → ' + esc(c.to) + ' ' + esc(c.unit); }).join(', ') +
                '<p class="muted">The radio puts the old values back by itself <span data-adv-until="' + esc(a.pending.revertAt) + '"></span> unless you press Keep. Watch the clients come back first.</p>' +
                '<div class="adv-actions"><button type="button" class="btn-primary btn-sm" data-adv="keep"' + (adv.busy ? ' disabled' : '') + '>Keep the change</button>' +
                '<button type="button" class="btn-secondary btn-sm" data-adv="undo"' + (adv.busy ? ' disabled' : '') + '>Undo now</button></div></div>';
        } else if (a.pending && a.pending.expired) {
            h += '<p class="muted">The last change was not kept, so the radio put the old values back.</p>';
        }
        if (a.changes && a.changes.length) {
            var canAny = a.changes.some(function (c) { return c.applicable; });
            if (a.experimental && canAny) {
                h += '<div class="adv-exp"><strong>Experimental on Ubiquiti radios.</strong> This has not been proven on a real radio yet. Try it first on one quiet sector, at a quiet hour, with the sector open in front of you. It needs SSH turned on in the radio\'s Services page. <div class="adv-actions"><button type="button" class="btn-secondary btn-sm" data-adv="preflight"' + (adv.busy ? ' disabled' : '') + '>Test this radio (read-only)</button>' +
                    (pf ? (pf.ok ? '<span class="adv-ok">✓ Ready' + (pf.sample ? ' (sample)' : '') + (pf.frequency != null ? ' · ' + esc(pf.frequency) + ' MHz' : '') + (pf.txPower != null ? ' · ' + esc(pf.txPower) + ' dBm' : '') + '</span>' : '<span class="live-error">✗ ' + esc((pf.problems || [])[0] || 'Not ready') + '</span>') : '') + '</div></div>';
            }
            h += '<h5>Proposed changes</h5><div class="reg-wrap"><table class="iface-table adv-table"><thead><tr><th></th><th>Setting</th><th>Now</th><th>New</th><th>Why</th><th>Risk</th></tr></thead><tbody>' +
                a.changes.map(function (c, i) {
                    return '<tr><td>' + (c.applicable ? '<input type="checkbox" data-adv-change="' + i + '" aria-label="Apply ' + esc(c.label) + '">' : '<span class="muted" title="Set this one on the radio\'s own page">by hand</span>') + '</td>' +
                        '<td><strong>' + esc(c.label) + '</strong></td><td class="mono">' + esc(c.from == null ? '?' : c.from + ' ' + c.unit) + '</td><td class="mono"><strong>' + esc(c.to + ' ' + c.unit) + '</strong></td>' +
                        '<td>' + esc(c.reason) + '</td><td class="muted">' + esc(c.risk) + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                (canAny
                    ? '<div class="adv-actions"><button type="button" class="btn-primary btn-sm" id="adv-apply" data-adv="apply"' + (adv.busy ? ' disabled' : '') + '>Apply ticked changes</button><span class="muted">Nothing changes until you press this and confirm. It undoes itself after ' + esc((a.pending && a.pending.revertMinutes) || 5) + ' minutes unless you keep it.</span></div>'
                    : '<p class="muted">' + esc(a.applyNote || 'These have to be set on the radio\'s own page.') + '</p>');
        } else if (a.ai && !(a.pending && !a.pending.expired)) {
            h += '<p class="muted">The AI proposed no setting change for this sector.</p>';
        }
        return h + '</div>';
    }
    // Countdown on a pending change.
    setInterval(function () {
        var el = document.querySelector('#adv-panel [data-adv-until]');
        if (!el) return;
        var left = Math.max(0, Math.round((Number(el.dataset.advUntil) - Date.now()) / 1000));
        el.textContent = left ? 'in ' + Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2) : 'now';
    }, 1000);

    function registrationBlock(m) {
        var rows = (m && m.stations) || [];
        if (!rows.length) return '<p class="muted">No stations registered right now.</p>';
        var matched = 0;
        var body = rows.map(function (c) {
            var s = sas.byMac[macKey(c.mac)];
            if (s) matched++;
            var user = s
                ? '<strong>' + esc(s.username) + '</strong><div class="muted">' + esc(s.plan || '') + (s.online === false ? ' · session offline' : '') + (s.station && s.station.near ? ' · ≈ MAC one step off' : '') + '</div>'
                : '<span class="muted">' + (sas.configured ? 'Not in SAS' : '—') + '</span>';
            var rate = (c.txRate != null || c.rxRate != null) ? (c.txRate != null ? c.txRate : '–') + '/' + (c.rxRate != null ? c.rxRate : '–') : '–';
            return '<tr class="row-click" data-sta-mac="' + esc(c.mac || '') + '" tabindex="0" title="Show this radio\'s signal history"><td>' + esc(c.name || c.ip || c.mac) + (c.platform ? '<div class="muted">' + esc(c.platform) + '</div>' : '') + '</td>' +
                '<td class="mono">' + esc(c.mac || '–') + (c.ip ? '<div class="muted">' + esc(c.ip) + '</div>' : '') + '</td>' +
                '<td>' + user + '</td>' +
                '<td class="mono">' + (c.signal != null ? esc(c.signal) + ' dBm' : '–') + '</td>' +
                '<td class="mono">' + (c.ccq != null ? esc(c.ccq) + '%' : '–') + '</td>' +
                '<td class="mono">' + esc(rate) + '</td>' +
                '<td class="mono">' + esc(bps(c.txBps)) + '</td><td class="mono">' + esc(bps(c.rxBps)) + '</td></tr>';
        }).join('');
        var note = sas.configured
            ? matched + ' of ' + rows.length + ' matched to a SAS user by MAC address'
            : 'Connect your RADIUS/SAS server on the SAS page to see each station\'s PPPoE user (matched by MAC address).';
        return '<p class="muted reg-note">' + esc(rows.length) + ' registered · ' + esc(note) + ' <button type="button" class="link-btn" data-export-reg>Export to Excel</button></p>' +
            '<div class="reg-wrap"><table class="iface-table reg-table"><thead><tr><th>Station</th><th>MAC / IP</th><th>SAS user</th><th>Signal</th><th>CCQ</th><th>Rate tx/rx</th><th>↓ To client</th><th>↑ From client</th></tr></thead><tbody>' +
            body + '</tbody></table></div>';
    }

    // Signal history of one customer radio, shown in a row under it. Only recorded while the app
    // is open, so the line has gaps for the hours it was closed.
    function signalChart(samples) {
        var pts = samples.filter(function (s) { return s.signal !== null; });
        if (pts.length < 2) return '';
        var W = 640, H = 90, pad = 6;
        var vals = pts.map(function (s) { return s.signal; });
        var lo = Math.min.apply(null, vals) - 2, hi = Math.max.apply(null, vals) + 2;
        var t0 = pts[0].t, span = Math.max(1, pts[pts.length - 1].t - t0);
        var d = '', prevT = null;
        pts.forEach(function (s) {
            var x = (pad + ((s.t - t0) / span) * (W - pad * 2)).toFixed(1);
            var y = (pad + (1 - (s.signal - lo) / (hi - lo)) * (H - pad * 2)).toFixed(1);
            // More than 20 minutes between samples = the app was closed: break the line.
            d += (prevT !== null && s.t - prevT < 20 * 60 * 1000 ? 'L' : 'M') + x + ',' + y;
            prevT = s.t;
        });
        return '<svg class="traffic-chart sta-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Signal history"><path class="rx-line" d="' + d + '"/></svg>';
    }
    function toggleStationHistory(tr) {
        var next = tr.nextElementSibling;
        if (next && next.classList.contains('sta-history')) { next.remove(); return; }
        var body = tr.parentNode;
        Array.prototype.forEach.call(body.querySelectorAll('.sta-history'), function (x) { x.remove(); });
        var row = document.createElement('tr');
        row.className = 'sta-history';
        row.innerHTML = '<td colspan="8"><p class="muted">Loading signal history…</p></td>';
        body.insertBefore(row, tr.nextSibling);
        var cell = row.firstChild;
        fetch('/api/history/station/' + encodeURIComponent(tr.dataset.staMac))
            .then(function (r) { return r.json(); })
            .then(function (j) {
                var pts = (j.samples || []).filter(function (s) { return s.signal !== null; });
                if (!j.enabled) { cell.innerHTML = '<p class="muted">History is not being recorded on this install.</p>'; return; }
                if (pts.length < 2) { cell.innerHTML = '<p class="muted">Not enough history yet — a point is saved every 5 minutes while TowerDesk is open.</p>'; return; }
                var vals = pts.map(function (s) { return s.signal; });
                var avg = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
                var hours = Math.round((pts[pts.length - 1].t - pts[0].t) / 360000) / 10;
                cell.innerHTML = '<div class="sta-history-head"><strong>Signal over the last ' + esc(hours >= 48 ? Math.round(hours / 24) + ' days' : hours + ' h') + '</strong>' +
                    '<span class="muted">best ' + esc(Math.max.apply(null, vals)) + ' · average ' + esc(avg) + ' · worst ' + esc(Math.min.apply(null, vals)) + ' dBm · ' + pts.length + ' points</span></div>' + signalChart(pts);
            })
            .catch(function () { cell.innerHTML = '<p class="muted">Could not load the history.</p>'; });
    }

    function exportRegistration(id) {
        var d = lastData && lastData.devices.find(function (x) { return x.id === id; });
        var rows = (d && d.metrics && d.metrics.stations) || [];
        window.TowerDesk.exportCsv('registration-' + String(d ? d.name : 'sector').replace(/[^\w-]+/g, '_') + '.csv',
            ['Sector', 'Station', 'Model', 'MAC', 'IP', 'SAS user', 'Plan', 'Signal (dBm)', 'CCQ (%)', 'TX rate (Mbps)', 'RX rate (Mbps)', 'To client (bps)', 'From client (bps)'],
            rows.map(function (c) {
                var s = sas.byMac[macKey(c.mac)] || {};
                return [d.name, c.name, c.platform, c.mac, c.ip, s.username, s.plan, c.signal, c.ccq, c.txRate, c.rxRate, c.txBps, c.rxBps];
            }));
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
        var nClients = mx.clientCount != null ? mx.clientCount : mx.stationCount;
        if (nClients != null) keys.push(['Clients', nClients]);
        if (!keys.length) { keys.push(['Now', ms(d.latencyMs)]); keys.push(['Uptime', d.uptimePct === null ? '–' : d.uptimePct + '%']); }
        var top = mx.interfaces && mx.interfaces[0];
        if (top && top.rxBps != null && keys.length < 4) keys.push(['Traffic', bps(top.rxBps)]);
        keys.push([state === 'offline' ? 'Down' : (state === 'online' ? 'Up' : 'Unknown'), d.since ? ago(d.since) : '–']);
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
    // When both radios of a link are managed, the server pairs them (peerId). The pair is shown
    // as ONE link: the "primary" end keeps the card, the other is folded into it as the far end.
    // (The pairing rules live in insights.js so the Overview and Topology pages agree.)
    function peerOf(d) { return lastData ? I.peerOf(d, lastData.devices) : null; }
    function isFarEnd(d) { return lastData ? I.isFarEnd(d, lastData.devices) : false; }
    function modelOf(d) { var det = (d.lastTest && d.lastTest.details) || {}; return det.model || TYPE_LABELS[d.type] || d.type; }

    function backhaulCard(d) {
        var state = d.online === true ? 'online' : (d.online === false ? 'offline' : 'unknown');
        var mx = d.metrics || {};
        var r = mx.radio || {};
        var det = (d.lastTest && d.lastTest.details) || {};
        var peer = peerOf(d);
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
        strip += cell(state === 'offline' ? 'Down for' : (state === 'online' ? 'Up for' : 'Unknown for'), d.since ? ago(d.since) : '–');
        var mid = '<div class="bh-mid"><div class="bh-state ' + (state === 'online' ? 'ok' : state) + '">' +
            (state === 'offline' ? 'link down' : (state === 'online' ? 'connected' : (d.unreachable ? 'unreachable' : 'checking…'))) + '</div>' +
            '<div class="bh-wire ' + state + '"></div>' +
            '<div class="muted">' + esc([linkTxt, r.freq, signalTxt].filter(Boolean).join(' · ')) + '</div>' +
            '<div class="bh-ends ' + (peer ? 'both' : 'one') + '">' + (peer ? 'Both ends monitored' : 'Slave end only') + '</div></div>';
        return '<article class="backhaul-card ' + state + '" data-id="' + esc(d.id) + '" tabindex="0" role="button">' +
            '<div class="bh-link">' +
                (peer
                    ? bhEnd('remote', peer.name, 'Master · ' + modelOf(peer), peer.ip)
                    : bhEnd('remote', masterName, 'Master' + (r.remoteModel ? ' · ' + r.remoteModel : ' · at provider'), '')) +
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
        if (has(mx.onuCount)) t.push(['ONUs online', mx.onuOnline + ' / ' + mx.onuCount]);
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
    // Live rows for one managed radio: its own readings, and the direction it transmits.
    function endRows(dev) {
        var mx = dev.metrics || {};
        var r = mx.radio || {};
        var top = mx.interfaces && mx.interfaces[0];
        var has = function (v) { return v !== undefined && v !== null && v !== ''; };
        var ccq = has(r.ccq) ? r.ccq : mx.ccq;
        var rows = [];
        if (dev.online === false) return [['Status', 'Offline']];
        if (has(r.signal)) rows.push(['Signal', r.signal + ' dBm']);
        if (has(r.snr)) rows.push(['SNR', r.snr + ' dB']);
        if (has(ccq)) rows.push(['CCQ', ccq + '%']);
        if (has(r.txRate)) rows.push(['Rate', r.txRate + ' Mbps']);
        if (top && has(top.txBps)) rows.push(['Traffic sent', bps(top.txBps)]);
        if (has(r.txpower)) rows.push(['Tx power', r.txpower + ' dBm']);
        return rows.length ? rows : [['Data', 'Collecting…']];
    }
    function linkEnd(side, title, sub, mono, rows, monitored, openId) {
        return '<section class="link-end ' + side + '">' + dishArt() +
            '<div class="link-end-name">' + esc(title) + '</div><div class="muted">' + esc(sub) + '</div>' +
            (mono ? '<div class="muted mono">' + esc(mono) + '</div>' : '') +
            '<div class="link-end-tag ' + (monitored ? 'on' : 'off') + '">' + (monitored ? '● Monitored' : '○ Not monitored — read from the slave') + '</div>' +
            (openId ? '<button type="button" class="link-btn" data-open-id="' + esc(openId) + '">Open this end</button>' : '') +
            '<dl class="link-end-data">' + rows.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
            '</section>';
    }
    // Both ends managed (paired): each end shows its own radio's live readings.
    // Only this end managed: it reports both directions of the link, so the far end shows the
    // direction it transmits (what this radio receives); its own signal/CCQ appear only if the
    // radio reports them.
    function linkHero(d) {
        var state = d.online === true ? 'online' : (d.online === false ? 'offline' : 'unknown');
        var mx = d.metrics || {};
        var r = mx.radio || {};
        var det = (d.lastTest && d.lastTest.details) || {};
        var top = mx.interfaces && mx.interfaces[0];
        var has = function (v) { return v !== undefined && v !== null && v !== ''; };
        var peer = peerOf(d);
        var near = endRows(d);
        var far = [];
        if (peer) far = endRows(peer);
        else {
            if (has(r.remoteSignal)) far.push(['Signal', r.remoteSignal + ' dBm']);
            if (has(r.remoteCcq)) far.push(['CCQ', r.remoteCcq + '%']);
            if (has(r.rxRate)) far.push(['Rate', r.rxRate + ' Mbps']);
            if (top && has(top.rxBps)) far.push(['Traffic sent', bps(top.rxBps)]);
            if (!far.length) far.push(['Data', 'Not reported']);
        }
        // d is drawn on the right; label the ends by which one is the master when we can tell.
        var dIsMaster = peer ? isFarEnd(d) : false;
        var facts = [r.linkName || det.link, r.freq, has(r.chanbw) ? r.chanbw + ' MHz' : '', has(r.distance) ? r.distance + ' km' : ''].filter(Boolean);
        var total = top && has(top.rxBps) ? bps((top.rxBps || 0) + (top.txBps || 0)) : (has(r.throughput) ? r.throughput + ' Mb/s' : '');
        return '<div class="link-hero ' + state + '">' +
            (peer
                ? linkEnd('far', peer.name, (dIsMaster ? 'Slave' : 'Master') + ' · ' + modelOf(peer), peer.ip, far, true, peer.id)
                : linkEnd('far', r.remoteName || det.remote || 'Upstream', 'Master' + (r.remoteModel ? ' · ' + r.remoteModel : ''), '', far, false, '')) +
            '<div class="link-mid">' +
                '<div class="bh-state ' + (state === 'online' ? 'ok' : state) + '">' + (state === 'offline' ? 'link down' : (state === 'online' ? 'connected' : (d.unreachable ? 'unreachable' : 'checking…'))) + '</div>' +
                '<div class="link-beam ' + state + '"><span></span></div>' +
                (total ? '<div class="link-total">' + esc(total) + '</div><div class="muted">total traffic</div>' : '') +
                '<div class="muted link-facts">' + esc(facts.join(' · ')) + '</div>' +
            '</div>' +
            linkEnd('near', d.name, (dIsMaster ? 'Master' : 'Slave') + ' · ' + modelOf(d), d.ip, near, true, '') +
            '</div>';
    }

    // The device's own web page. The saved port is only used when it is a web port (the MikroTik
    // API or SNMP port would not open in a browser).
    function webUrl(d) {
        var web = ['http', 'https', 'tplink', 'airos', 'mimosa'].indexOf(d.method) >= 0;
        var scheme = (d.method === 'https' || d.method === 'airos') ? 'https' : 'http';
        return scheme + '://' + d.ip + (web && d.port ? ':' + d.port : '');
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
            '<div class="detail-actions">' +
                '<a class="btn-secondary btn-sm" href="' + esc(webUrl(d)) + '" target="_blank" rel="noopener">Open device page ↗</a>' +
                window.TowerDesk.netTools(d.ip) +
            '</div>' +
            (d.role === 'backhaul' ? linkHero(d) : '') +
            '<dl class="kv detail-kv">' + info.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
            '<h4 class="detail-sec">Live</h4>' + statGrid(d) +
            '<h4 class="detail-sec">Latency (10 min)</h4>' + sparkline(d.history) +
            (d.online !== false && d.metrics && d.metrics.kind === 'stations' ? '<h4 class="detail-sec">Advisor</h4>' + advisorBlock(d) : '') +
            (d.online !== false && d.metrics && d.metrics.kind === 'stations' ? '<h4 class="detail-sec">Registration (connected stations)</h4>' + registrationBlock(d.metrics) : '') +
            (d.online !== false && d.metrics && d.metrics.kind === 'onus' ? '<h4 class="detail-sec">ONUs (fibre customers)</h4>' + onuBlock(d.metrics) : '') +
            (d.online === false ? '' : '<h4 class="detail-sec">Traffic' + (d.metrics && d.metrics.kind === 'stations' ? '' : ' &amp; ' + (d.metrics && d.metrics.kind === 'clients' ? 'clients' : 'interfaces')) + '</h4>' + metricsBlock(d.metrics));
    }

    function ensureModal() {
        var m = document.getElementById('detail-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'detail-modal';
        m.className = 'modal-overlay';
        m.innerHTML = '<div class="modal detail-modal"><div class="modal-header"><strong>Device detail</strong><button class="close-btn" aria-label="Close">×</button></div><div class="modal-body" id="detail-modal-body"></div></div>';
        document.body.appendChild(m);
        m.addEventListener('click', function (e) {
            var other = e.target.closest('[data-open-id]');
            if (other) { openDetail(other.dataset.openId); return; }
            if (e.target.closest('[data-export-reg]')) { exportRegistration(detailId); return; }
            if (e.target.closest('[data-export-onu]')) { exportOnus(detailId); return; }
            var advBtn = e.target.closest('[data-adv]');
            if (advBtn) {
                var act = advBtn.dataset.adv;
                if (act === 'check') advRun(false); else if (act === 'ai') advRun(true); else if (act === 'apply') advApply(); else if (act === 'preflight') advPreflight(); else advFinish(act);
                return;
            }
            var staRow = e.target.closest('tr[data-sta-mac]');
            if (staRow && staRow.dataset.staMac) { toggleStationHistory(staRow); return; }
            if (e.target === m || e.target.closest('.close-btn')) closeDetail();
        });
        m.addEventListener('input', function (e) {
            if (e.target.id !== 'onu-filter') return;
            onuFilter = e.target.value;
            var d = lastData && lastData.devices.find(function (x) { return x.id === detailId; });
            var tb = document.getElementById('onu-rows');
            if (d && tb) tb.innerHTML = onuRows(d.metrics);
        });
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
        var isSector = !!(d.metrics && d.metrics.kind === 'stations');
        var isOlt = !!(d.metrics && d.metrics.kind === 'onus');
        if (isSector || isOlt) loadSas();
        m.querySelector('.detail-modal').classList.toggle('wide', isLink || isSector || isOlt);
        m.querySelector('.modal-header strong').textContent = isLink ? 'Link detail' : (isSector ? 'Sector detail' : (isOlt ? 'OLT detail' : 'Device detail'));
        document.getElementById('detail-modal-body').innerHTML = detailBody(d);
        m.style.display = 'flex';
    }
    function closeDetail() {
        detailId = null;
        adv = { id: null, busy: false, data: null, error: null, msg: '', pf: null };
        onuFilter = '';
        var m = document.getElementById('detail-modal');
        if (m) m.style.display = 'none';
    }

    // ----- "Needs attention" (rules shared with the Overview page: insights.js) -----
    var ATT_MAX = 8;
    function attentionItems(devices) { return I.attention(lastData ? lastData.devices : devices, sas.byMac).filter(function (it) { return devices.some(function (d) { return d.id === it.id; }); }); }
    function renderAttention(devices) {
        var cardEl = $('attention-card');
        if (!cardEl) return;
        var known = devices.filter(function (d) { return !d.unreachable && d.online !== null && d.online !== undefined; });
        cardEl.hidden = !known.length;
        if (!known.length) return;
        if (devices.some(function (d) { return d.metrics && ((d.metrics.stations && d.metrics.stations.length) || (d.metrics.onus && d.metrics.onus.length)); })) loadSas();
        var items = attentionItems(devices);
        $('attention-count').textContent = items.length ? items.length + (items.length === 1 ? ' item' : ' items') : '';
        $('attention-list').innerHTML = items.length
            ? items.slice(0, ATT_MAX).map(function (it) {
                return '<li class="' + it.sev + '"><a class="att-link" href="/monitoring?open=' + encodeURIComponent(it.id) + (DEMO ? '&demo=1' : '') + '" data-id="' + esc(it.id) + '"><span class="att-dot" aria-hidden="true"></span><span class="att-what">' + esc(it.what) + '</span><span class="att-why">' + esc(it.why) + '</span></a></li>';
            }).join('') + (items.length > ATT_MAX ? '<li class="att-ok">and ' + (items.length - ATT_MAX) + ' more</li>' : '')
            : '<li class="att-ok">Nothing needs attention — every reachable device, link and customer radio looks fine.</li>';
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
        var nb = $('net-banner');
        if (nb) {
            nb.hidden = !data.networkDown;
            $('net-banner-nets').textContent = (data.unreachableNetworks || []).length ? ' (' + data.unreachableNetworks.join(', ') + ')' : '';
        }
        renderProviderTabs(data.devices);
        var shown = selectedProvider === 'all' ? data.devices : data.devices.filter(function (d) { return provKey(d) === selectedProvider; });
        var s = { total: shown.length, online: shown.filter(function (d) { return d.online === true; }).length, offline: shown.filter(function (d) { return d.online === false; }).length };
        var sectors = shown.filter(function (d) { return d.role === 'sector'; });
        var subs = sectors.reduce(function (a, d) { var m = d.metrics || {}; return a + (m.clientCount || m.stationCount || 0); }, 0);
        // A paired link is one link: fold its far end into the primary end's card, and count its
        // traffic once (both radios report the same traffic).
        var folded = function (d) { return isFarEnd(d) && shown.indexOf(peerOf(d)) >= 0; };
        var trafficBps = shown.reduce(function (a, d) {
            if (!d.online || folded(d)) return a;
            var ifs = (d.metrics && d.metrics.interfaces) || [];
            return a + ifs.reduce(function (b, i) { return b + (i.rxBps || 0) + (i.txBps || 0); }, 0);
        }, 0);
        renderAttention(shown);
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
            var backhaul = list.filter(function (x) { return x.role === 'backhaul' && !folded(x); });
            var rest = list.filter(function (x) { return x.role !== 'backhaul'; });
            var html = '';
            if (backhaul.length) html += '<div class="monitor-section-label">Backhaul links</div>' + backhaul.map(backhaulCard).join('');
            if (rest.length) html += (backhaul.length ? '<div class="monitor-section-label">Sectors &amp; devices</div>' : '') + rest.map(card).join('');
            grid.innerHTML = html;
        }

        if (detailId) {
            var dd = data.devices.find(function (x) { return x.id === detailId; });
            if (dd) {
                if (hasList(dd)) loadSas();
                var body = document.getElementById('detail-modal-body');
                // Leave the card alone while a ping/traceroute result or a station's history is
                // open in it — refreshing would wipe what the user is reading.
                if (body && !detailBusy(body)) body.innerHTML = detailBody(dd);
            }
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
                // Deep link from other pages: /monitoring?open=<device id> opens that device once.
                if (openOnLoad) { var want = openOnLoad; openOnLoad = null; openDetail(want); }
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

    var attList = document.getElementById('attention-list');
    if (attList) {
        attList.addEventListener('click', function (e) {
            // Links (so they also work opened in a new tab); a plain click opens the card in place.
            var row = e.target.closest('a[data-id]');
            if (row && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); openDetail(row.dataset.id); }
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
