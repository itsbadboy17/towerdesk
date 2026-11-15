// Add Device page. Four parts: "Add a device" (one step at a time: find it, log in, name it), the saved logins,
// a scan of a whole network, and the list of devices with its bulk actions. TowerDesk works out what a device is
// and how to read it; the owner types its IP address, a login only when no saved login opens it, and a name only
// when the device has none of its own. Passwords and communities are sent to the server and never shown again.
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var esc = window.TowerDesk.fmt.esc;
    var result = $('device-result');
    var methods = {};
    var selectedIds = {}; // device ids ticked for bulk actions (kept across the 10 s reload)

    var TYPE_LABELS = { mikrotik: 'MikroTik', cisco: 'Cisco', switch: 'Switch', ubnt: 'Ubiquiti', mimosa: 'Mimosa', tplink: 'TP-Link', onu: 'ONU', olt: 'OLT', other: 'Other' };

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

    // Messages about the device list (Check, Delete, Fix unconnected, saving a login). They sit above the table and
    // are hidden while there is nothing to say. The add steps have their own messages and do not use this.
    function show(kind, html) {
        result.className = 'result-panel ad-msg ' + (kind || '');
        result.innerHTML = html;
        result.hidden = !html;
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

    // ----- Add a device, one step at a time -----
    // The steps (chips, Back / Next, one step shown at a time) come from /stepper.js. They go in order:
    //   find  : type the IP address. TowerDesk looks at the device and tries the saved logins.
    //   login : only when no saved login opened it and the way to connect needs a login or a community.
    //   name  : the name (taken from the device when it has one) and where it is. Then it is saved.
    //   done  : what was added, with a way to open it or add another.
    // The brand, in the owner's words.
    var BRAND = { mikrotik: 'MikroTik router', cisco: 'Cisco router', switch: 'Switch', ubnt: 'Ubiquiti device', mimosa: 'Mimosa radio', tplink: 'TP-Link router', onu: 'ONU (fiber)', olt: 'OLT (fiber)' };
    // What each way to connect means for the owner.
    var HOW = {
        ping: 'TowerDesk will only watch whether it is up.',
        mikrotik: 'TowerDesk will read it with the MikroTik API.',
        'mikrotik-ssl': 'TowerDesk will read it with the secure MikroTik API.',
        ssh: 'TowerDesk will log in to it over SSH.',
        telnet: 'TowerDesk will log in to it over Telnet.',
        snmp: 'TowerDesk will read it with SNMP.',
        snmp1: 'TowerDesk will read it with SNMP (version 1).',
        tplink: 'TowerDesk will log in to its web page.',
        airos: 'TowerDesk will log in to its web page.',
        mimosa: 'TowerDesk will log in to its web page.',
        http: 'TowerDesk will only check that its web page answers.',
        https: 'TowerDesk will only check that its web page answers.'
    };

    // What is known about the device being added. Started again for every device.
    //   type / typeByHand : its type, and whether the owner chose it (then TowerDesk never changes it)
    //   method            : how it will be saved; loginMethod: the way to connect that the Log in step asks a login for
    //   found             : what the look at the device returned; matched: the saved login that opened it
    //   ownName           : the name set on the device itself; name: what to suggest in the Name field
    //   test              : the result of a login typed in the Log in step, once it worked
    //   sawLogin          : the Log in step was shown, so Back from the name returns to it
    function freshFlow() {
        return { ip: '', type: 'other', typeByHand: false, method: 'ping', loginMethod: '', port: undefined, found: null, matched: null, ownName: '', name: '', test: null, sawLogin: false };
    }
    var F = freshFlow();
    var nameTyped = false; // the owner typed a name (or it came with a link), so the device's own name does not replace it

    // What TowerDesk knows about one way to connect. An older server does not send defaultUser: then it is admin
    // (ubnt on Ubiquiti airOS).
    function way(key) {
        var m = methods[key] || {};
        return {
            label: m.label || key,
            port: m.port || null,
            needsLogin: !!m.needsLogin,
            community: !!m.community,
            passwordOnly: !!m.passwordOnly,
            defaultUser: m.defaultUser || (key === 'airos' ? 'ubnt' : 'admin')
        };
    }

    // An error from the server in its own words; a broken connection to TowerDesk in ours.
    function plain(e) {
        var text = (e && e.message) || '';
        return !text || /failed to fetch|networkerror|load failed/i.test(text) ? 'Could not reach TowerDesk. Check that it is still running.' : text;
    }

    // Why a login did not work, in plain words: wrong login, no answer in time, or that login service is closed.
    function loginWhy(err, w) {
        var kind = window.TowerDesk.loginProblem(err);
        if (kind === 'auth') return w.community ? 'The device did not accept that community.' : (w.passwordOnly ? 'Wrong password. Check it and try again.' : 'Wrong username or password. Check them and try again.');
        if (kind === 'timeout') return w.community ? 'No answer. The community may be wrong, or SNMP is switched off on the device.' : 'The device did not answer in time. It may be slow, or the link to it loses packets. Try again.';
        if (kind === 'refused') return 'That login service is closed on the device: it is switched off, or it uses another port.';
        return err || 'Could not connect.';
    }

    // The typed login, added to a request only when the device is saved the way the Log in step asked about.
    // An empty username is left out: the server then uses the usual one (admin, or ubnt on Ubiquiti).
    function withLogin(body) {
        if (!F.loginMethod || F.method !== F.loginMethod) return body;
        var w = way(F.method);
        if (w.needsLogin) {
            if (!w.passwordOnly) body.username = $('device-username').value.trim() || undefined;
            body.password = $('device-password').value || undefined;
        }
        if (w.community) body.community = $('device-community').value || undefined;
        return body;
    }
    function clearLogin() { $('device-username').value = ''; $('device-password').value = ''; $('device-community').value = ''; }

    // The box that says what was found (Log in step) or what will be saved (Name step). Never a password.
    function summary(withFacts, extra) {
        var web = (F.found && F.found.web) || {}, snmp = (F.found && F.found.snmp) || {};
        var h = '<p><strong>' + esc(BRAND[F.type] || 'Device') + '</strong> at <span class="mono">' + esc(F.ip) + (F.port && F.method !== 'ping' ? ':' + esc(F.port) : '') + '</span></p>' +
            '<p>' + esc(HOW[F.method] || ('TowerDesk will connect with ' + way(F.method).label + '.')) + '</p>';
        if (extra) h += '<p class="muted">' + esc(extra) + '</p>';
        if (withFacts) h += details({ Model: web.model, Firmware: web.firmware, Name: F.ownName, Description: web.model ? '' : snmp.description });
        return h;
    }

    var A = window.TowerDesk.stepper({
        root: $('add-flow'),
        flow: function () { return ['find', 'login', 'name', 'done']; },
        title: function (step) { return { find: 'Find it', login: 'Log in', name: 'Name it' }[step] || ''; },
        intro: function (step) {
            if (step === 'find') return 'Type the IP address of the device. TowerDesk looks at it, works out what it is and tries your saved logins.';
            if (step === 'login') {
                var w = way(F.loginMethod);
                return 'Type ' + (w.community ? 'the SNMP community' : w.passwordOnly ? 'the password' : 'the login') + ' of this device. It is kept encrypted and is never shown again.';
            }
            if (step === 'name') return F.name || nameTyped ? 'Check the name, then add the device.' : 'Give it a name you will recognise, then add the device.';
            return 'The device is now in TowerDesk. Its first readings arrive in about 20 seconds.';
        },
        nextLabel: function (step) { return { find: 'Find it', login: 'Connect', name: 'Add device' }[step]; },
        // No way back once it is added. From the name, Back skips the Log in step when it was never shown.
        backTo: function (step) { return step === 'done' ? '' : (step === 'name' && !F.sawLogin ? 'find' : null); }
    });

    // Remember what a look at the device found: its brand (unless the owner chose the type) and a name to suggest.
    function learn(d) {
        F.found = d;
        if (!F.typeByHand) F.type = d.vendor || 'other';
        var model = d.web && d.web.model;
        var brand = d.vendor && d.vendor !== 'other' ? TYPE_LABELS[d.vendor] : '';
        F.ownName = d.name || (d.snmp && d.snmp.name) || '';
        F.name = F.ownName || (model ? (brand ? brand + ' ' : '') + model : '');
    }
    // Leave the first step: to Log in when this way to connect needs a login or a community, else straight to the name.
    function leaveFind(done) {
        var w = way(F.method);
        if (w.needsLogin || w.community) { F.loginMethod = F.method; done(true, 'login'); }
        else done(true, 'name');
    }

    A.guard('find', function (done) {
        var ip = $('device-ip').value.trim();
        if (!ip) { done(false, 'Type the device\'s IP address first.'); return; }
        var handType = $('device-type').value, handMethod = $('device-method').value;
        // Another device than last time: a login or a name typed for the other one must not follow it here.
        if (F.ip && ip !== F.ip) { clearLogin(); $('device-name').value = ''; nameTyped = false; }
        F = freshFlow();
        F.ip = ip;
        F.typeByHand = !!handType;
        F.type = handType || 'other';

        // The owner chose how to connect: the device may only answer on its unusual port, so nothing has to be
        // found first. When the type was left to TowerDesk, one quick look still tries to tell the brand.
        if (handMethod) {
            F.method = handMethod;
            F.port = $('device-port').value || undefined;
            if (handType) { leaveFind(done); return; }
            A.say('Looking at ' + ip + '…');
            api('POST', '/api/devices/detect', { ip: ip, tryVault: false })
                .then(function (d) { if (d && d.ok) learn(d); }, function () { /* not found: the chosen way is tried anyway */ })
                .then(function () { leaveFind(done); });
            return;
        }

        A.say('Looking at ' + ip + '. This can take a few seconds…');
        api('POST', '/api/devices/detect', { ip: ip, tryVault: true }).then(function (d) {
            if (!d.ok) {
                done(false, /invalid/i.test(d.error || '') ? 'That does not look like an IP address. It should look like 192.168.0.1.' : 'Nothing answered at that address. Check the IP, that the device is switched on, and that your VPN is connected.');
                return;
            }
            learn(d);
            // One of the saved logins already opens it: nothing to type, go straight to the name.
            if (d.matched && d.matched.method) {
                F.matched = d.matched;
                F.method = d.matched.method;
                if (d.matched.name) { F.ownName = d.matched.name; F.name = d.matched.name; }
                done(true, 'name');
                return;
            }
            F.method = d.suggestedMethod || 'ping';
            leaveFind(done);
        }).catch(function (e) { done(false, plain(e)); });
    });

    A.enter('login', function () {
        F.sawLogin = true;
        F.method = F.loginMethod; // back here after "Add it without a login": the login is offered again
        F.test = null;
        var w = way(F.method);
        $('ad-user-group').hidden = !w.needsLogin || w.passwordOnly;
        $('ad-pass-group').hidden = !w.needsLogin;
        $('ad-comm-group').hidden = !w.community;
        $('device-username').placeholder = w.defaultUser;
        $('ad-user-hint').textContent = 'Leave it empty to use ' + w.defaultUser + '.';
        $('ad-pass-hint').textContent = w.passwordOnly ? 'This device asks for a password only, with no username.' : '';
        $('ad-found').innerHTML = summary(true);
    });
    // Connect: try the typed login now. The device is only saved in the last step.
    A.guard('login', function (done) {
        var w = way(F.method);
        A.say('Connecting…');
        api('POST', '/api/devices/test', withLogin({ ip: F.ip, type: F.type, method: F.method, port: F.port })).then(function (t) {
            if (!t.ok) { done(false, loginWhy(t.error, w)); return; }
            F.test = t;
            if (t.deviceName) { F.ownName = t.deviceName; F.name = t.deviceName; }
            if (t.vendor && !F.typeByHand) F.type = t.vendor;
            done(true);
        }).catch(function (e) { done(false, plain(e)); });
    });
    $('ad-skip').addEventListener('click', function () {
        if (A.busy()) return;
        F.method = 'ping';
        F.test = null;
        A.go('name');
    });

    A.enter('name', function () {
        var w = way(F.method), field = $('device-name');
        if (!nameTyped) field.value = F.name || '';
        $('ad-name-hint').textContent = nameTyped ? '' : (field.value ? 'TowerDesk took this from the device. You can change it.' : 'Leave it empty to use the device\'s own name, or its IP address when it has none.');
        $('ad-save-sum').innerHTML = summary(false,
            F.matched ? (/^factory login/.test(F.matched.label || '') ? 'It still has its factory login (admin, no password). Set a password on it soon.' : F.matched.label ? 'It opens with your saved login "' + F.matched.label + '".' : 'It opens with one of your saved logins.')
                : F.test && F.test.ok ? (w.community ? 'The SNMP community works.' : 'The login works.')
                : F.method === 'ping' ? 'You can give it a login later: open the device and press Connect.' : '');
    });
    $('device-name').addEventListener('input', function () { nameTyped = !!this.value.trim(); $('ad-name-hint').textContent = ''; });
    // Add device: save it. The server tests the connection once more and, when no login was typed, tries the saved logins.
    A.guard('name', function (done) {
        var body = withLogin({ name: $('device-name').value.trim(), type: F.type, ip: F.ip, location: $('device-location').value.trim(), method: F.method, port: F.method === 'ping' ? undefined : F.port });
        // A login that was just typed and worked is the one to keep, so the saved logins are not tried over it.
        body.tryVault = !(F.test && F.test.ok);
        A.say('Adding it and testing the connection…');
        api('POST', '/api/devices', body).then(function (r) {
            showAdded(r);
            loadDevices();
            done(true);
        }).catch(function (e) { done(false, plain(e)); });
    });

    function showAdded(r) {
        var dev = r.device || {}, t = r.test || {};
        var label = r.matched && (r.matched.label || r.matched);
        var how = (methods[t.method || dev.method] || {}).label || t.method || dev.method || '';
        clearLogin(); // nothing typed stays in the page once the device is saved
        $('ad-done').innerHTML = '<p class="nb-ok">Added: ' + esc(dev.name || F.ip) + ' (' + esc(dev.ip || F.ip) + ')</p>' +
            (t.ok
                ? '<p>' + esc(t.summary || 'Connected') + (how ? ' <span class="muted">(' + esc(how) + (t.ms !== undefined ? ', ' + esc(t.ms) + ' ms' : '') + ')</span>' : '') + '</p>'
                : '<p class="result-title warn">It is saved, but the connection test did not work: ' + esc(loginWhy(t.error, way(t.method || dev.method))) + '</p><p class="muted">Open it and press Connect to set the right login.</p>') +
            (label ? '<p class="muted">' + (/^factory login/.test(label) ? 'It logged in with the factory login (admin, no password). Set a password on it soon.' : 'Your saved login "' + esc(label) + '" was used.') + '</p>' : '');
        $('ad-open').href = '/monitoring?open=' + encodeURIComponent(dev.id || '');
    }
    $('ad-again').addEventListener('click', function () {
        Array.prototype.forEach.call($('add-flow').querySelectorAll('input, select'), function (el) { el.value = ''; });
        $('ad-manual').open = false;
        F = freshFlow();
        nameTyped = false;
        syncPort();
        A.go('find');
    });

    // "Set it yourself": the port only means something together with a way to connect chosen by hand.
    function syncPort() {
        var key = $('device-method').value, port = $('device-port');
        var off = !key || key === 'ping', usual = way(key).port;
        port.disabled = off;
        if (off) port.value = '';
        port.placeholder = usual && !off ? String(usual) : 'Usual port';
        $('ad-port-hint').textContent = !key ? 'Choose how to connect first.' : (key === 'ping' ? 'Ping does not use a port.' : 'Leave it empty to use the usual port' + (usual ? ' (' + usual + ')' : '') + '.');
    }
    $('device-method').addEventListener('change', function () { $('device-port').value = ''; syncPort(); });

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

    // What the "are you sure" dialog says under its title when devices are removed.
    var REMOVE_DEVICE = { text: 'Nothing is changed on the device itself. Its history in TowerDesk is removed.', yes: 'Remove', danger: true };

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
        var n = selectedCount();
        window.TowerDesk.inlineConfirm(this, 'Remove ' + n + ' device' + (n === 1 ? '' : 's') + ' from TowerDesk?', REMOVE_DEVICE).then(function (yes) {
            if (!yes) return;
            bulkRun('Deleting', function (id) {
                return api('DELETE', '/api/devices/' + encodeURIComponent(id)).then(function () { delete selectedIds[id]; });
            });
        });
    });

    $('device-list').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-act]');
        if (!btn) return;
        var row = btn.closest('tr');
        var id = row.dataset.id;
        var nameEl = row.querySelector('.name-btn');
        var name = nameEl ? nameEl.textContent : '';
        if (btn.dataset.act === 'detail') {
            // The device card (connection, ping, advisor) lives on the Monitoring page.
            location.href = '/monitoring?open=' + encodeURIComponent(id);
        } else if (btn.dataset.act === 'delete') {
            window.TowerDesk.inlineConfirm(btn, 'Remove ' + (name || 'this device') + ' from TowerDesk?', REMOVE_DEVICE).then(function (yes) {
                if (!yes) return;
                return api('DELETE', '/api/devices/' + encodeURIComponent(id)).then(function () {
                    show('ok', '<p class="result-title ok">Removed "' + esc(name) + '". Nothing was changed on the device.</p>');
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
        // A web page title such as "RouterOS router configuration page" is not a name: use the brand and the address.
        var pageTitle = /configuration page|web ?fig|login|welcome|index of|router ?os router|^(home|admin)$/i.test(f.name || '');
        var name = f.name && f.name === f.model && label ? label + ' ' + f.model : (f.name && !pageTitle ? f.name : ((label || 'Device') + ' ' + f.ip));
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

    // Coming from Topology ("seen on your network, not added") or from "Set up a device": start with what is
    // already known. The IP goes into the first step, the name waits in the Name step, and a type that came with
    // the link counts as chosen by hand.
    (function prefill() {
        try {
            var q = new URLSearchParams(location.search);
            var nm = q.get('name'), ip = q.get('ip'), ty = q.get('type');
            if (!nm && !ip && !ty) return;
            if (nm) { $('device-name').value = nm.slice(0, 80); nameTyped = true; }
            if (ip) $('device-ip').value = ip.slice(0, 45);
            if (ty && Array.prototype.some.call($('device-type').options, function (o) { return o.value === ty; })) $('device-type').value = ty;
            $('device-ip').focus();
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
            chips.push('<span class="vault-chip" data-id="' + esc(l.id) + '" data-kind="login" data-label="' + esc(l.label) + '"><span class="vault-kind">login</span> ' + esc(l.label) + (l.username ? ' <span class="muted">(' + esc(l.username) + ')</span>' : '') + ' <button type="button" aria-label="Remove ' + esc(l.label) + '">✕</button></span>');
        });
        (v.communities || []).forEach(function (c) {
            chips.push('<span class="vault-chip" data-id="' + esc(c.id) + '" data-kind="community" data-label="' + esc(c.label) + '"><span class="vault-kind">snmp</span> ' + esc(c.label) + ' <button type="button" aria-label="Remove ' + esc(c.label) + '">✕</button></span>');
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
            .catch(function (err) {
                // The message area is further down the page, next to the device list: bring it into view.
                show('bad', '<p class="result-title bad">❌ ' + esc(err.message) + '</p>');
                result.scrollIntoView({ block: 'nearest' });
            })
            .then(function () { busy(btn, false); });
    });
    $('vault-list').addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var chip = btn.closest('.vault-chip');
        var what = chip.dataset.kind === 'community' ? 'saved SNMP community' : 'saved login';
        window.TowerDesk.inlineConfirm(btn, 'Remove the ' + what + ' "' + (chip.dataset.label || '') + '"?', { text: 'Devices that already use it keep working.', yes: 'Remove', danger: true }).then(function (yes) {
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

    api('GET', '/api/devices/methods')
        .then(function (m) { methods = m; })
        .catch(function () { /* keep defaults */ })
        .then(function () { syncPort(); syncVaultFields(); populateBulkMethods(); loadDevices(); loadVault(); });
    setInterval(function () {
        // Don't redraw while a confirmation is open or a bulk selection is in progress.
        if (!$('td-confirm') && selectedCount() === 0) loadDevices();
    }, 10000);
})();
