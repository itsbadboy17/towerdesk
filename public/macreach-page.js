// A new MikroTik with no IP yet, set up through a MikroTik that can see it (the relay). The steps: choose the relay,
// choose the new router from what the relay sees next to it (so its MAC address never has to be found or typed), say
// which address to give it, then check the exact commands and run them. The relay logs in to it by MAC address
// (MAC-Telnet). Looking and previewing are read-only; running needs the admin's "allow writing" switch. Passwords typed
// here are used for this one request.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    if (!$('mr-relay')) return;
    var esc = window.TowerDesk.fmt.esc, MM = window.TowerDesk.macreachModel, S = window.TowerDesk.setup;
    var q = new URLSearchParams(location.search);
    // relays: the MikroTiks TowerDesk connects to. found: what the chosen relay sees (for the relay foundFor).
    // picked: the row chosen from that list; null when the MAC address was typed by hand or came from a link.
    var relays = [], found = null, foundFor = '', picked = null;

    function api(method, url, body) {
        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(function (r) { return r.json(); });
    }
    function val(id) { return $(id).value.trim(); }
    function body() {
        return { relayId: $('mr-relay').value, mac: val('mr-mac'), factoryUser: val('mr-fuser') || 'admin', factoryPass: $('mr-fpass').value, ip: val('mr-ip'), prefix: val('mr-prefix') || 24,
            gateway: val('mr-gw'), name: val('mr-name'), newPassword: $('mr-newpass').value, interface: val('mr-if') || 'ether1', allowApiFrom: val('mr-api') };
    }
    var FIELD = { mac: 'mr-mac', factoryUser: 'mr-fuser', factoryPass: 'mr-fpass', ip: 'mr-ip', prefix: 'mr-prefix', gateway: 'mr-gw', name: 'mr-name', newPassword: 'mr-newpass', interface: 'mr-if', allowApiFrom: 'mr-api' };
    function relay() { var id = $('mr-relay').value; return relays.filter(function (d) { return d.id === id; })[0] || null; }
    function relayName() { var r = relay(); return r ? r.name : 'the MikroTik you chose'; }
    function clearErrors() { Array.prototype.forEach.call(document.querySelectorAll('#su .mr-err'), function (e) { e.textContent = ''; }); }

    // ---------------- which one: the list of what the relay sees ----------------
    function pick(c) {
        picked = c;
        $('mr-mac').value = c.mac;
        // The relay also learnt which of the new router's ports faces it: that is where the address goes.
        var port = MM.facingPort(c.farPort), f = $('mr-if');
        if (port && (!f.value.trim() || f.dataset.auto === '1')) { f.value = port; f.dataset.auto = '1'; }
    }
    function card(c) {
        var on = !!picked && picked.mac === c.mac;
        var about = c.mikrotik ? [c.model, c.version ? 'RouterOS ' + c.version : ''].filter(Boolean).join(' · ') : c.model;
        var where = 'Seen on ' + (c.port || 'one of its ports') + ' · ' + (c.ip ? 'has the address ' + c.ip : 'no address yet') + (c.why ? ' · ' + c.why : '');
        return '<label class="pv-card mr-dev' + (on ? ' on' : '') + (c.can ? '' : ' off') + '"><input type="radio" name="mr-pick" value="' + esc(c.mac) + '"' + (on ? ' checked' : '') + (c.can ? '' : ' disabled') + '>' +
            '<span class="mr-dev-top"><strong>' + esc(c.name || 'No name') + '</strong>' + (about ? '<span class="nb-chip">' + esc(about) + '</span>' : '') + '<span class="mono">' + esc(c.mac) + '</span></span>' +
            '<span class="muted">' + esc(where) + '</span></label>';
    }
    function renderFound() {
        var list = found || [], can = list.filter(function (c) { return c.can; }), h = '';
        if (!list.length) h = '<p class="muted">' + esc(relayName()) + ' does not see any device next to it right now.</p>';
        else h = (can.length ? '' : '<p class="pv-off">' + esc(relayName()) + ' sees ' + list.length + ' device' + (list.length === 1 ? '' : 's') + ' next to it, but none of them is a new MikroTik.</p>') + list.map(card).join('');
        $('mr-found').innerHTML = h;
        if (!can.length) $('mr-manual').open = true;
    }
    // Ask the relay what it sees (read-only). done(true) when the list is ready.
    function look(done) {
        var r = relay();
        if (!r) { done(false, relays.length ? 'Choose the MikroTik it is plugged in next to.' : 'Add a MikroTik with the MikroTik API first: the new router is found through it.'); return; }
        S.say('Asking ' + r.name + ' what it sees…');
        api('POST', '/api/macreach/look', { relayId: r.id }).then(function (j) {
            if (!j.ok) { done(false, j.error || 'Could not read that MikroTik.'); return; }
            found = j.found || []; foundFor = r.id;
            // A free address next to the chosen MikroTik, so TowerDesk can reach the new router. Never over what was typed.
            if (j.suggest && (!val('mr-ip') || $('mr-ip').dataset.auto === '1')) { $('mr-ip').value = j.suggest.ip; $('mr-ip').dataset.auto = '1'; }
            if (j.suggest) { $('mr-ip').placeholder = j.suggest.ip; $('mr-gw').placeholder = j.suggest.gateway; }
            var can = found.filter(function (c) { return c.can; }), typed = val('mr-mac').toUpperCase();
            var again = can.filter(function (c) { return c.mac === typed; })[0];
            if (again) pick(again);
            else if (picked) { picked = null; $('mr-mac').value = ''; }
            // One new MikroTik and nothing chosen yet: that is the one.
            if (!picked && !val('mr-mac') && can.length === 1) pick(can[0]);
            renderFound();
            done(true);
        }).catch(function () { done(false, 'Could not reach TowerDesk.'); });
    }
    function lookAgain() {
        S.busy(true);
        look(function (ok, why) { S.busy(false); var n = (found || []).length; S.say(ok ? 'Looked again: ' + n + ' device' + (n === 1 ? '' : 's') + ' seen.' : why, !ok); });
    }

    S.guard('relay', look);
    S.enter('pick', function () { if (foundFor !== $('mr-relay').value) lookAgain(); });
    S.guard('pick', function (done) {
        clearErrors();
        var mac = val('mr-mac');
        if (MM.MAC_RE.test(mac)) { done(true); return; }
        if (mac) { $('mr-mac-e').textContent = 'A MAC address looks like 4C:5E:0C:8A:1F:88.'; $('mr-manual').open = true; done(false, 'Check the MAC address.'); return; }
        done(false, (found || []).some(function (c) { return c.can; }) ? 'Choose the new router from the list.' : 'The new router is not in the list yet. Press Look again, or type its MAC address.');
    });

    // ---------------- its address, then the preview ----------------
    S.enter('address', function () {
        var c = picked;
        $('mr-sum').innerHTML = 'Setting up <strong>' + esc(c && c.name ? c.name : 'the new router') + '</strong>' + (c && c.model ? ' (' + esc(c.model) + ')' : '') + ', MAC address <span class="mono">' + esc(val('mr-mac').toUpperCase()) + '</span>, through <strong>' + esc(relayName()) + '</strong>' + (c && c.port ? ', which sees it on ' + esc(c.port) : '') + '.' +
            (c && c.ip ? ' It already has the address <span class="mono">' + esc(c.ip) + '</span> (usually from DHCP). That one stays; the address below is added as its fixed address.' : '');
    });
    // Leaving the address step asks the relay about that MAC and the address, and builds the preview. Nothing is typed.
    S.guard('address', function (done) {
        clearErrors();
        S.say('Asking ' + relayName() + ' about it…');
        api('POST', '/api/macreach/plan', body()).then(function (p) {
            if (!p.ok) {
                Object.keys(p.errors || {}).forEach(function (k) { var e = $(FIELD[k] + '-e'); if (e) e.textContent = p.errors[k]; });
                done(false, p.errors && p.errors.mac ? 'Go back and choose the new router again.' : (p.error || 'Check the highlighted fields.'));
                return;
            }
            show(p); done(true);
        }).catch(function () { done(false, 'Could not reach TowerDesk.'); });
    });

    function show(p) {
        var h = '<p class="mr-path"><strong>TowerDesk</strong> → SSH → <strong>' + esc(p.relay.name) + '</strong> (' + esc(p.relay.ip) + ') → MAC-Telnet → <strong>' + esc(val('mr-mac').toUpperCase()) + '</strong></p>';
        if (p.seen) h += '<p class="nb-ok">✓ ' + esc(p.relay.name) + ' sees this MAC address on ' + esc(p.seen.interface || 'one of its ports') + (p.seen.identity ? ' (identity “' + esc(p.seen.identity) + '”)' : '') + '.</p>';
        if (p.conflict) h += '<p class="live-error" role="alert">' + esc(p.conflict) + '</p>';
        h += '<div class="table-wrap"><table><thead><tr><th>Command typed on the new router</th><th>Why</th></tr></thead><tbody>' + p.commands.map(function (c) { return '<tr><td class="mono">' + esc(c.cmd) + '</td><td>' + esc(c.why) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        h += '<ul class="pv-problems">' + p.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
        h += '<p class="muted">If it cannot be reached afterwards, TowerDesk removes only what it added (everything it adds carries the comment “TowerDesk setup”).</p>';
        if (!p.writeOn) h += '<p class="pv-off">Writing is <strong>switched off</strong>, so this is a preview only. An admin can switch it on in Settings (Device setup).</p>';
        if (p.canApply) h += '<div class="form-actions"><button type="button" class="btn-primary" id="mr-run">Run it</button><span class="muted">Types the commands on the new router through ' + esc(p.relay.name) + '.</span></div>';
        $('mr-out').innerHTML = h;
    }

    function done(r) {
        var ip = r.ip, name = r.name || '';
        $('mr-out').innerHTML = '<p class="nb-ok">✓ Done. The router answers on ' + esc(ip) + (r.identity ? ' as “' + esc(r.identity) + '”' : '') + (r.deviceId ? ' and is now in TowerDesk.' : '.') + '</p>' +
            '<div class="form-actions">' + (r.deviceId ? '<a class="btn-primary" href="/monitoring?open=' + encodeURIComponent(r.deviceId) + '">Open it</a>' : '<a class="btn-primary" href="/add-device?name=' + encodeURIComponent(name) + '&ip=' + encodeURIComponent(ip) + '&type=mikrotik">Add it to TowerDesk</a>') +
            '<a class="btn-secondary" href="/provision?brand=mikrotik&ip=' + encodeURIComponent(ip) + '">Then set up its radio</a></div>';
    }

    document.addEventListener('click', function (e) {
        if (e.target.id === 'mr-rescan') lookAgain();
        else if (e.target.id === 'mr-run') {
            e.target.disabled = true;
            $('mr-out').insertAdjacentHTML('beforeend', '<p class="muted" id="mr-wait">Working through the relay. This can take up to a minute…</p>');
            api('POST', '/api/macreach/apply', body()).then(function (r) {
                var w = $('mr-wait'); if (w) w.remove();
                if (r.ok) done(r); else { $('mr-out').insertAdjacentHTML('beforeend', '<p class="live-error" role="alert">' + esc(r.error || 'It did not work.') + '</p>'); e.target.disabled = false; }
            }).catch(function () { e.target.disabled = false; });
        }
    });
    document.addEventListener('change', function (e) {
        if (e.target.name === 'mr-pick') {
            var c = (found || []).filter(function (x) { return x.mac === e.target.value && x.can; })[0];
            if (!c) return;
            pick(c);
            Array.prototype.forEach.call(document.querySelectorAll('#mr-found .mr-dev'), function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
            S.say('');
        } else if (e.target.id === 'mr-relay') {
            // Another relay sees other devices: what was chosen from the old list no longer applies.
            found = null; foundFor = '';
            if (picked) { picked = null; $('mr-mac').value = ''; }
        }
    });
    document.addEventListener('input', function (e) {
        if (e.target.id === 'mr-mac') {
            picked = null;
            Array.prototype.forEach.call(document.querySelectorAll('#mr-found .mr-dev'), function (l) { l.querySelector('input').checked = false; l.classList.remove('on'); });
        } else if (e.target.id === 'mr-if' || e.target.id === 'mr-ip') delete e.target.dataset.auto;
    });

    api('GET', '/api/devices').then(function (list) {
        relays = (Array.isArray(list) ? list : []).filter(function (d) { return /^mikrotik/.test(d.method || ''); });
        $('mr-relay').innerHTML = '<option value="">' + (relays.length ? 'Choose a MikroTik…' : 'No MikroTik with the API is added yet') + '</option>' + relays.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + ' (' + esc(d.ip) + ')</option>'; }).join('');
        var via = q.get('via');
        if (via && relays.some(function (d) { return d.id === via; })) $('mr-relay').value = via;
        else if (relays.length === 1) $('mr-relay').value = relays[0].id;
        // A link from Topology ("Set up by MAC") already names the router, and usually the MikroTik that sees it.
        if (MM.MAC_RE.test(q.get('mac') || '')) { $('mr-mac').value = q.get('mac').toUpperCase(); S.choose('mac'); S.go($('mr-relay').value ? 'address' : 'relay'); }
    }).catch(function () { $('mr-relay').innerHTML = '<option value="">Could not load your devices</option>'; });
    if (q.get('name')) $('mr-name').value = q.get('name');
})();
