// "Set up a radio": IP, what it will be, the values, a preview of exactly what changes, and (only when writing has been
// switched on in Settings) an apply with a 5-minute undo. Passwords typed here go to the server for this request only.
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = window.TowerDesk.fmt.esc;
    var PM = window.TowerDesk.provisionModel;
    var state = { template: 'sector', brand: 'airos', last: null, timer: null };

    function api(method, url, body) {
        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
            .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
    }
    function say(id, text, bad) { var el = $(id); if (el) { el.textContent = text || ''; el.className = bad ? 'live-error' : 'muted'; } }

    function renderTemplates() {
        $('pv-templates').innerHTML = Object.keys(PM.TEMPLATES).map(function (k) {
            var t = PM.TEMPLATES[k];
            return '<label class="pv-card' + (state.template === k ? ' on' : '') + '"><input type="radio" name="pv-t" value="' + k + '"' + (state.template === k ? ' checked' : '') + '><strong>' + esc(t.label) + '</strong><span class="muted">' + esc(t.about) + '</span></label>';
        }).join('');
        renderFields();
    }
    function renderFields() {
        var t = PM.TEMPLATES[state.template];
        $('pv-fields').innerHTML = '<div class="pv-grid">' + t.fields.map(function (f) {
            var d = PM.FIELDS[f];
            return '<div class="form-group"><label for="pv-f-' + f + '">' + esc(d.label) + (d.required ? '' : ' <span class="muted">(optional)</span>') + '</label>' +
                '<input id="pv-f-' + f + '" data-field="' + f + '" type="' + (d.secret ? 'password' : 'text') + '" autocomplete="off" ' + (d.secret ? 'autocomplete="new-password" ' : '') + 'maxlength="64"><span class="muted pv-hint">' + esc(d.hint) + '</span><span class="live-error" id="pv-e-' + f + '" role="alert"></span></div>';
        }).join('') + '</div>';
    }
    function values() { var v = {}; Array.prototype.forEach.call(document.querySelectorAll('#pv-fields [data-field]'), function (i) { v[i.dataset.field] = i.value; }); return v; }
    function body() { return { host: $('pv-ip').value.trim(), username: $('pv-user').value.trim() || undefined, password: $('pv-pass').value, brand: state.brand, template: state.template, values: values() }; }

    function showPlan(p) {
        var out = $('pv-out'), h = '';
        if (!p.ok) { out.innerHTML = '<p class="live-error" role="alert">' + esc(p.error || 'Check the highlighted fields.') + '</p>'; Object.keys(p.errors || {}).forEach(function (f) { var e = $('pv-e-' + f); if (e) e.textContent = p.errors[f]; }); return; }
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
        if (!p.writeOn) h += '<p class="pv-off">Writing to radios is <strong>switched off</strong>, so this is a preview only. An admin can switch it on in Settings when you are ready to try it on a spare radio.</p>';
        if (p.canApply) h += '<div class="form-actions"><button type="button" class="btn-primary" id="pv-apply">Apply now (with a ' + p.revertMin + '-minute undo)</button><span class="muted">The radio puts its old settings back by itself unless you press Keep.</span></div>';
        out.innerHTML = h;
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

    document.addEventListener('click', function (e) {
        var id = e.target.id;
        if (id === 'pv-look') {
            var ip = $('pv-ip').value.trim();
            if (!ip) { say('pv-look-msg', 'Type the IP address first.', true); return; }
            say('pv-look-msg', 'Looking…');
            api('POST', '/api/devices/detect', { ip: ip, tryVault: false }).then(function (d) {
                if (!d.ok) { say('pv-look-msg', 'Nothing answered at that address. Check the IP and that your VPN is open.', true); return; }
                if (d.vendor === 'mikrotik') { $('pv-brand').value = 'mikrotik'; state.brand = 'mikrotik'; }
                else if (d.vendor === 'ubnt') { $('pv-brand').value = 'airos'; state.brand = 'airos'; }
                say('pv-look-msg', 'Found: ' + (d.vendor || 'a device') + (d.web && d.web.model ? ', ' + d.web.model : '') + '.');
            }).catch(function () { say('pv-look-msg', 'Could not look at it.', true); });
        } else if (id === 'pv-preview') {
            Array.prototype.forEach.call(document.querySelectorAll('#pv-fields .live-error'), function (x) { x.textContent = ''; });
            if (state.brand === 'airos' && !$('pv-pass').value) { $('pv-out').innerHTML = '<p class="live-error" role="alert">Type the radio\'s password (the one for its web page and SSH).</p>'; return; }
            $('pv-out').innerHTML = '<p class="muted">Reading the radio…</p>';
            api('POST', '/api/provision/plan', body()).then(showPlan).catch(function () { $('pv-out').innerHTML = '<p class="live-error">Could not reach TowerDesk.</p>'; });
        } else if (id === 'pv-apply') {
            e.target.disabled = true;
            api('POST', '/api/provision/apply', body()).then(function (j) {
                if (!j.ok) { $('pv-out').insertAdjacentHTML('beforeend', '<p class="live-error" role="alert">' + esc(j.error || 'Not applied.') + '</p>'); e.target.disabled = false; return; }
                countdown(j.revertAt, j.applied);
            });
        } else if (id === 'pv-keep' || id === 'pv-undo') {
            say('pv-live-msg', 'Working…');
            api('POST', '/api/provision/' + (id === 'pv-keep' ? 'keep' : 'undo'), { host: $('pv-ip').value.trim() }).then(function (j) {
                if (j.ok) { clearInterval(state.timer); $('pv-live').innerHTML = '<p><strong>' + (id === 'pv-keep' ? 'Kept.' : 'Undone.') + '</strong> ' + (id === 'pv-keep' ? 'The settings are saved on the radio.' : 'The radio has its old settings back.') + '</p>'; }
                else say('pv-live-msg', j.error || 'It did not work.', true);
            });
        }
    });
    document.addEventListener('change', function (e) {
        if (e.target.name === 'pv-t') { state.template = e.target.value; renderTemplates(); $('pv-out').innerHTML = ''; }
        else if (e.target.id === 'pv-brand') state.brand = e.target.value;
    });
    renderTemplates();
})();
