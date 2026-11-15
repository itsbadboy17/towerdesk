// "Set up a device", one step at a time. The first step asks what is being set up; the steps after it depend on the
// answer (provisionModel.flow). Two kinds of setup share the page: a radio that already answers at an IP address (this
// file: its settings, a preview of exactly what changes and, only when writing has been switched on in Settings, an
// apply with a 5-minute undo) and a new MikroTik with no IP yet (macreach-page.js). The steps go in order: Next checks
// the step before moving on and Back returns. Passwords typed here go to the server for this request only.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.TowerDesk.fmt.esc;
    var PM = window.TowerDesk.provisionModel;
    var root = $('su');
    var state = { template: '', brand: 'airos', timer: null };

    function api(method, url, body) {
        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
            .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
    }

    // ---------------- the steps ----------------
    // The chips, the help line, Back / Next and the one-step-at-a-time rules come from /stepper.js (S below).
    // S.guard(step, fn): fn(done) checks a step before leaving it; done(true) moves on, done(false, why) stays.
    // S.enter(step, fn): fn() runs when a step is shown.
    var kind = ''; // what is being set up (a key of PM.KINDS); '' until something is chosen
    var INTRO = {
        kind: function () { return 'What do you want to set up?'; },
        relay: function () { return 'Plug the new MikroTik into the same switch as a MikroTik you already have, and switch it on. Then choose that MikroTik here: it can see the new one and log in to it, even though the new one has no IP address yet.'; },
        pick: function () { var o = $('mr-relay').selectedOptions[0]; return 'These are the devices <strong>' + esc(o && o.value ? o.textContent : 'that MikroTik') + '</strong> sees next to it right now. Choose the new one. You do not need to find or type its MAC address.'; },
        address: function () { return 'Say how to log in to it and which address to give it. TowerDesk also turns on its API and can set its name and a new password.'; },
        run: function () { return 'This is exactly what would be typed on the new router. Nothing has been typed yet.'; },
        radio: function () { return 'Type the radio\'s IP address and its login. The login is used for this setup only and is not saved. Ubiquiti radios need SSH switched on (Services page) so TowerDesk can keep an undo copy. MikroTik is a preview for now.'; },
        settings: function () { return 'Fill in the settings for: <strong>' + esc((PM.TEMPLATES[state.template] || {}).label || '') + '</strong>.'; },
        apply: function () { return 'This is what would change on the radio. Nothing has been written yet.'; }
    };
    var NEXT = { relay: 'Next: find the new router', pick: 'Next: its address', address: 'Preview', radio: 'Next: its settings', settings: 'Preview the changes' };

    var S = window.TowerDesk.stepper({
        root: root,
        flow: function () { return PM.flow(kind); },
        title: function (step) { return PM.STEP_TITLES[step]; },
        intro: function (step) { return INTRO[step](); },
        nextLabel: function (step) { return NEXT[step]; }
    });
    var say = S.say;
    // The first step cannot be left until something is chosen.
    S.guard('kind', function (done) { if (kind) done(true); else done(false, 'Choose what you are setting up first.'); });

    function renderKinds() {
        $('su-kinds').innerHTML = PM.KINDS.map(function (k) {
            return '<label class="pv-card"><input type="radio" name="su-kind" value="' + k.key + '"><strong>' + esc(k.label) + '</strong><span class="muted">' + esc(k.about) + '</span></label>';
        }).join('');
    }
    function choose(key) {
        if (!PM.KINDS.some(function (k) { return k.key === key; })) return;
        kind = key;
        if (PM.TEMPLATES[key]) { state.template = key; renderFields(); $('pv-out').innerHTML = ''; }
        Array.prototype.forEach.call(document.querySelectorAll('#su-kinds .pv-card'), function (c) { var i = c.querySelector('input'); i.checked = i.value === key; c.classList.toggle('on', i.checked); });
        S.render();
    }

    // ---------------- a radio that already has an IP address ----------------
    function renderFields() {
        var t = PM.TEMPLATES[state.template];
        $('pv-fields').innerHTML = '<div class="pv-grid">' + t.fields.map(function (f) {
            var d = PM.FIELDS[f];
            return '<div class="form-group"><label for="pv-f-' + f + '">' + esc(d.label) + (d.required ? '' : ' <span class="muted">(optional)</span>') + '</label>' +
                '<input id="pv-f-' + f + '" data-field="' + f + '" type="' + (d.secret ? 'password' : 'text') + '" autocomplete="' + (d.secret ? 'new-password' : 'off') + '" maxlength="64"><span class="muted pv-hint">' + esc(d.hint) + '</span><span class="live-error" id="pv-e-' + f + '" role="alert"></span></div>';
        }).join('') + '</div>';
    }
    function values() { var v = {}; Array.prototype.forEach.call(document.querySelectorAll('#pv-fields [data-field]'), function (i) { v[i.dataset.field] = i.value; }); return v; }
    function body() { return { host: $('pv-ip').value.trim(), username: $('pv-user').value.trim() || undefined, password: $('pv-pass').value, brand: state.brand, template: state.template, values: values() }; }

    function showPlan(p) {
        var h = '';
        if (p.brand === 'mikrotik') {
            h += '<p class="muted">' + esc(p.note) + '</p><pre class="pv-cmd">' + esc(p.commands.join('\n')) + '</pre>';
        } else {
            h += '<div class="table-wrap"><table><thead><tr><th>Setting</th><th>Now</th><th>Will become</th><th></th></tr></thead><tbody>' + p.rows.map(function (r) {
                var st = { change: '<span class="status-badge warning">changes</span>', same: '<span class="status-badge healthy">already so</span>', missing: '<span class="status-badge">not on this radio</span>' }[r.status];
                return '<tr><td>' + esc(r.label) + '<div class="muted mono">' + esc(r.key) + '</div></td><td class="mono">' + esc(r.from === null ? '–' : r.from) + '</td><td class="mono"><strong>' + esc(r.to) + '</strong></td><td>' + st + '</td></tr>';
            }).join('') + '</tbody></table></div>';
            if (p.problems && p.problems.length) h += '<ul class="pv-problems">' + p.problems.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
            h += '<p class="muted">' + p.changes + ' setting' + (p.changes === 1 ? '' : 's') + ' would change. Nothing has been written to the radio.</p>';
        }
        if (!p.writeOn) h += '<p class="pv-off">Writing to radios is <strong>switched off</strong>, so this is a preview only. An admin can switch it on in Settings (Device setup) when you are ready to try it on a spare radio.</p>';
        if (p.canApply) h += '<div class="form-actions"><button type="button" class="btn-primary" id="pv-apply">Apply now (with a ' + p.revertMin + '-minute undo)</button><span class="muted">The radio puts its old settings back by itself unless you press Keep.</span></div>';
        $('pv-out').innerHTML = h;
    }

    function countdown(revertAt, applied) {
        clearInterval(state.timer);
        var box = $('pv-live');
        box.hidden = false;
        var tick = function () {
            var left = Math.max(0, Math.round((revertAt - Date.now()) / 1000));
            box.innerHTML = '<p><strong>Applied.</strong> The radio will put the old settings back in <strong class="mono">' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</strong> unless you keep them. Check that the radio still answers and the link is up.</p>' +
                '<ul class="pv-problems">' + applied.map(function (a) { return '<li>' + esc(a.label) + ': ' + esc(a.from === null ? '–' : a.from) + ' → ' + esc(a.to) + '</li>'; }).join('') + '</ul>' +
                (left ? '<div class="form-actions"><button type="button" class="btn-primary" id="pv-keep">Keep these settings</button><button type="button" class="btn-secondary" id="pv-undo">Undo now</button><span class="muted" id="pv-live-msg" role="status"></span></div>' : '<p class="muted">The time is up: the radio has put its old settings back.</p>');
            if (!left) clearInterval(state.timer);
        };
        tick(); state.timer = setInterval(tick, 1000);
    }
    function sayIn(id, text, bad) { var el = $(id); if (el) { el.textContent = text || ''; el.className = bad ? 'live-error' : 'muted'; } }

    S.guard('radio', function (done) {
        if (!$('pv-ip').value.trim()) { done(false, 'Type the radio\'s IP address first.'); return; }
        if (state.brand === 'airos' && !$('pv-pass').value) { done(false, 'Type the radio\'s password (the one for its web page and SSH).'); return; }
        done(true);
    });
    // Leaving the settings step reads the radio and builds the preview. Nothing is written.
    S.guard('settings', function (done) {
        Array.prototype.forEach.call(document.querySelectorAll('#pv-fields .live-error'), function (x) { x.textContent = ''; });
        say('Reading the radio…');
        api('POST', '/api/provision/plan', body()).then(function (p) {
            if (!p.ok) { Object.keys(p.errors || {}).forEach(function (f) { var e = $('pv-e-' + f); if (e) e.textContent = p.errors[f]; }); done(false, p.error || 'Check the highlighted fields.'); return; }
            showPlan(p); done(true);
        }).catch(function () { done(false, 'Could not reach TowerDesk.'); });
    });

    document.addEventListener('click', function (e) {
        var id = e.target.id;
        if (id === 'pv-look') {
            var ip = $('pv-ip').value.trim();
            if (!ip) { sayIn('pv-look-msg', 'Type the IP address first.', true); return; }
            sayIn('pv-look-msg', 'Looking…');
            api('POST', '/api/devices/detect', { ip: ip, tryVault: false }).then(function (d) {
                if (!d.ok) { sayIn('pv-look-msg', 'Nothing answered at that address. Check the IP and that your VPN is open.', true); return; }
                if (d.vendor === 'mikrotik') { $('pv-brand').value = 'mikrotik'; state.brand = 'mikrotik'; }
                else if (d.vendor === 'ubnt') { $('pv-brand').value = 'airos'; state.brand = 'airos'; }
                sayIn('pv-look-msg', 'Found: ' + (d.vendor || 'a device') + (d.web && d.web.model ? ', ' + d.web.model : '') + '.');
            }).catch(function () { sayIn('pv-look-msg', 'Could not look at it.', true); });
        } else if (id === 'pv-apply') {
            e.target.disabled = true;
            api('POST', '/api/provision/apply', body()).then(function (j) {
                if (!j.ok) { $('pv-out').insertAdjacentHTML('beforeend', '<p class="live-error" role="alert">' + esc(j.error || 'Not applied.') + '</p>'); e.target.disabled = false; return; }
                countdown(j.revertAt, j.applied);
            });
        } else if (id === 'pv-keep' || id === 'pv-undo') {
            sayIn('pv-live-msg', 'Working…');
            api('POST', '/api/provision/' + (id === 'pv-keep' ? 'keep' : 'undo'), { host: $('pv-ip').value.trim() }).then(function (j) {
                if (j.ok) { clearInterval(state.timer); $('pv-live').innerHTML = '<p><strong>' + (id === 'pv-keep' ? 'Kept.' : 'Undone.') + '</strong> ' + (id === 'pv-keep' ? 'The settings are saved on the radio.' : 'The radio has its old settings back.') + '</p>'; }
                else sayIn('pv-live-msg', j.error || 'It did not work.', true);
            });
        }
    });
    document.addEventListener('change', function (e) {
        if (e.target.name === 'su-kind') choose(e.target.value);
        else if (e.target.id === 'pv-brand') state.brand = e.target.value;
    });

    // The other script (a new MikroTik with no IP yet) adds its own steps through this.
    window.TowerDesk.setup = { guard: S.guard, enter: S.enter, choose: choose, go: S.go, say: S.say, busy: S.busy };

    renderKinds();
    try { var qs = new URLSearchParams(location.search); if (qs.get('ip')) $('pv-ip').value = qs.get('ip'); if (qs.get('brand') === 'mikrotik') { $('pv-brand').value = 'mikrotik'; state.brand = 'mikrotik'; } } catch (e) { /* optional */ }
})();
