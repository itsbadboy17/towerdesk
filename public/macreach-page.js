// "Reach it by MAC": a MikroTik with no IP, plugged into the same switch as one you already have. The relay MikroTik
// logs in to it by MAC address (MAC-Telnet) and gives it an address, turns on its API and sets its name.
// Preview first; running it needs the admin's "allow writing" switch. Passwords typed here are used for this one request.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    if (!$('mr-card')) return;
    var esc = window.TowerDesk.fmt.esc;
    var q = new URLSearchParams(location.search);

    function api(method, url, body) {
        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(function (r) { return r.json(); });
    }
    function val(id) { return $(id).value.trim(); }
    function body() {
        return { relayId: $('mr-relay').value, mac: val('mr-mac'), factoryUser: val('mr-fuser') || 'admin', factoryPass: $('mr-fpass').value, ip: val('mr-ip'), prefix: val('mr-prefix') || 24,
            gateway: val('mr-gw'), name: val('mr-name'), newPassword: $('mr-newpass').value, interface: val('mr-if') || 'ether1', allowApiFrom: val('mr-api') };
    }
    var FIELD = { mac: 'mr-mac', factoryUser: 'mr-fuser', factoryPass: 'mr-fpass', ip: 'mr-ip', prefix: 'mr-prefix', gateway: 'mr-gw', name: 'mr-name', newPassword: 'mr-newpass', interface: 'mr-if', allowApiFrom: 'mr-api' };

    function clearErrors() { Array.prototype.forEach.call(document.querySelectorAll('#mr-card .mr-err'), function (e) { e.textContent = ''; }); }
    function show(p) {
        var out = $('mr-out');
        if (!p.ok) {
            Object.keys(p.errors || {}).forEach(function (k) { var e = $(FIELD[k] + '-e'); if (e) e.textContent = p.errors[k]; });
            out.innerHTML = '<p class="live-error" role="alert">' + esc(p.error || 'Check the highlighted fields.') + '</p>';
            return;
        }
        var h = '<p class="mr-path"><strong>TowerDesk</strong> → SSH → <strong>' + esc(p.relay.name) + '</strong> (' + esc(p.relay.ip) + ') → MAC-Telnet → <strong>' + esc($('mr-mac').value.trim().toUpperCase()) + '</strong></p>';
        if (p.seen) h += '<p class="nb-ok">✓ ' + esc(p.relay.name) + ' sees this MAC address on ' + esc(p.seen.interface || 'one of its ports') + (p.seen.identity ? ' (identity “' + esc(p.seen.identity) + '”)' : '') + '.</p>';
        if (p.conflict) h += '<p class="live-error" role="alert">' + esc(p.conflict) + '</p>';
        h += '<div class="table-wrap"><table><thead><tr><th>Command typed on the new router</th><th>Why</th></tr></thead><tbody>' + p.commands.map(function (c) { return '<tr><td class="mono">' + esc(c.cmd) + '</td><td>' + esc(c.why) + '</td></tr>'; }).join('') + '</tbody></table></div>';
        h += '<ul class="pv-problems">' + p.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
        h += '<p class="muted">If it cannot be reached afterwards, TowerDesk removes only what it added (everything it adds carries the comment “TowerDesk setup”).</p>';
        if (!p.writeOn) h += '<p class="pv-off">Writing is <strong>switched off</strong>, so this is a preview only. An admin can switch it on in Settings (Radio setup).</p>';
        if (p.canApply) h += '<div class="form-actions"><button type="button" class="btn-primary" id="mr-run">Run it</button><span class="muted">Types the commands on the new router through ' + esc(p.relay.name) + '.</span></div>';
        out.innerHTML = h;
    }

    function done(r) {
        var ip = r.ip, name = r.name || '';
        $('mr-out').innerHTML = '<p class="nb-ok">✓ Done. The router answers on ' + esc(ip) + (r.identity ? ' as “' + esc(r.identity) + '”' : '') + '.</p>' +
            '<div class="form-actions"><a class="btn-primary" href="/add-device?name=' + encodeURIComponent(name) + '&ip=' + encodeURIComponent(ip) + '&type=mikrotik">Add it to TowerDesk</a>' +
            '<a class="btn-secondary" href="/provision?brand=mikrotik&ip=' + encodeURIComponent(ip) + '">Then set up its radio</a></div>';
    }

    document.addEventListener('click', function (e) {
        if (e.target.id === 'mr-preview') {
            clearErrors();
            if (!$('mr-relay').value) { $('mr-out').innerHTML = '<p class="live-error" role="alert">Choose the MikroTik that will act as the relay.</p>'; return; }
            $('mr-out').innerHTML = '<p class="muted">Asking ' + esc($('mr-relay').selectedOptions[0].textContent) + ' what it can see…</p>';
            api('POST', '/api/macreach/plan', body()).then(show).catch(function () { $('mr-out').innerHTML = '<p class="live-error">Could not reach TowerDesk.</p>'; });
        } else if (e.target.id === 'mr-run') {
            e.target.disabled = true;
            $('mr-out').insertAdjacentHTML('beforeend', '<p class="muted" id="mr-wait">Working through the relay. This can take up to a minute…</p>');
            api('POST', '/api/macreach/apply', body()).then(function (r) {
                var w = $('mr-wait'); if (w) w.remove();
                if (r.ok) done(r); else { $('mr-out').insertAdjacentHTML('beforeend', '<p class="live-error" role="alert">' + esc(r.error || 'It did not work.') + '</p>'); e.target.disabled = false; }
            }).catch(function () { e.target.disabled = false; });
        }
    });

    // relays: the MikroTiks TowerDesk already connects to
    Promise.all([api('GET', '/api/devices'), api('GET', '/api/neighbors' + (window.TowerDesk.demo ? '?demo=1' : '')).catch(function () { return {}; })]).then(function (r) {
        var relays = (Array.isArray(r[0]) ? r[0] : []).filter(function (d) { return /^mikrotik/.test(d.method || ''); });
        $('mr-relay').innerHTML = '<option value="">' + (relays.length ? 'Choose a relay…' : 'No MikroTik with the API is added yet') + '</option>' + relays.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + ' (' + esc(d.ip) + ')</option>'; }).join('');
        var via = q.get('via'); if (via && relays.some(function (d) { return d.id === via; })) $('mr-relay').value = via;
        var unk = ((r[1] && r[1].unknown) || []).filter(function (u) { return u.mac && !u.ip; });
        $('mr-macs').innerHTML = unk.map(function (u) { return '<option value="' + esc(u.mac) + '">' + esc(u.name || '') + '</option>'; }).join('');
    });
    if (q.get('mac')) $('mr-mac').value = q.get('mac');
    if (q.get('name')) $('mr-name').value = q.get('name');
})();
