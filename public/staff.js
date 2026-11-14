// Settings > Staff accounts. Talks to /api/users (admin only on the server). Passwords are typed here and
// sent once; they are never shown again and never stored in the browser.
(function () {
    'use strict';
    var root = document.getElementById('staff-body');
    if (!root) return;
    var esc = window.TowerDesk.fmt.esc;
    var ROLE_TEXT = { admin: 'Admin', tech: 'Technician', viewer: 'Viewer' };
    var state = null, msg = '';

    function api(method, url, body) {
        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
            .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
    }
    function say(t, bad) { msg = (bad ? '⚠ ' : '') + t; var el = document.getElementById('staff-msg'); if (el) { el.textContent = msg; el.className = bad ? 'live-error' : 'muted'; } }
    function roleSelect(name, role, disabled) {
        return '<select data-role-for="' + esc(name) + '" aria-label="Role of ' + esc(name) + '"' + (disabled ? ' disabled' : '') + '>' +
            state.roles.map(function (r) { return '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' + ROLE_TEXT[r] + '</option>'; }).join('') + '</select>';
    }
    function render() {
        if (!state) { root.innerHTML = '<p class="muted">Loading…</p>'; return; }
        var html = '';
        if (!state.configured) {
            html += '<p class="source-banner warn"><strong>The login is off.</strong> Anyone who can open this page can change everything. Create the first account (it becomes the admin) to turn the login on. You will be signed in right away.</p>';
        }
        html += '<div class="staff-roles"><div><strong>Admin</strong><span class="muted">Everything: staff, settings, saved logins, backups, updates and money.</span></div>' +
            '<div><strong>Technician</strong><span class="muted">Devices, monitoring, the advisor and neighbours. No staff, settings or money.</span></div>' +
            '<div><strong>Viewer</strong><span class="muted">Look only, plus ping and traceroute. Cannot change anything.</span></div></div>';
        if (state.users.length) {
            html += '<div class="table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Password</th><th></th></tr></thead><tbody>' + state.users.map(function (u) {
                var me = u.username === state.me;
                return '<tr><td><strong>' + esc(u.username) + '</strong>' + (me ? ' <span class="nb-chip">you</span>' : '') + '</td><td>' + roleSelect(u.username, u.role, false) + '</td>' +
                    '<td><span class="staff-pw" data-pw-row="' + esc(u.username) + '"><button type="button" class="btn-secondary btn-sm" data-pw-open="' + esc(u.username) + '">Set a new password</button></span></td>' +
                    '<td>' + (me ? '' : '<button type="button" class="btn-secondary btn-sm" data-del="' + esc(u.username) + '">Delete</button>') + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        }
        html += '<form id="staff-form" class="detail-edit" autocomplete="off"><h4 class="detail-sec">Add an account</h4><div class="form-row">' +
            '<div class="form-group"><label for="st-user">Username</label><input type="text" id="st-user" autocomplete="off" maxlength="32"></div>' +
            '<div class="form-group"><label for="st-pass">Password (8 or more characters)</label><input type="password" id="st-pass" autocomplete="new-password"></div>' +
            '<div class="form-group"><label for="st-role">Role</label><select id="st-role">' + (state.configured ? state.roles.map(function (r) { return '<option value="' + r + '">' + ROLE_TEXT[r] + '</option>'; }).join('') : '<option value="admin">Admin</option>') + '</select></div></div>' +
            '<div class="form-actions"><button type="submit" class="btn-primary">' + (state.configured ? 'Add account' : 'Create the admin account') + '</button><span id="staff-msg" class="muted" role="status">' + esc(msg) + '</span></div></form>';
        root.innerHTML = html;
    }
    function load() {
        return api('GET', '/api/users').then(function (j) {
            if (j.status === 403) { root.innerHTML = '<p class="muted">Only an admin can manage staff accounts.</p>'; return; }
            state = j; render();
        }).catch(function () { root.innerHTML = '<p class="muted">Could not load the accounts.</p>'; });
    }
    root.addEventListener('submit', function (e) {
        if (e.target.id !== 'staff-form') return;
        e.preventDefault();
        var u = document.getElementById('st-user').value.trim(), p = document.getElementById('st-pass').value, r = document.getElementById('st-role').value;
        say('Saving…');
        api('POST', '/api/users', { username: u, password: p, role: r }).then(function (j) {
            if (j.error) { say(j.error, true); return; }
            msg = 'Added ' + j.username + '.';
            if (j.firstAccount) { location.reload(); return; }
            load();
        }).catch(function () { say('Could not reach TowerDesk.', true); });
    });
    root.addEventListener('change', function (e) {
        var sel = e.target.closest('[data-role-for]');
        if (!sel) return;
        api('PUT', '/api/users/' + encodeURIComponent(sel.dataset.roleFor), { role: sel.value }).then(function (j) {
            if (j.error) { say(j.error, true); load(); return; }
            msg = 'Role changed.'; load();
        });
    });
    root.addEventListener('click', function (e) {
        var open = e.target.closest('[data-pw-open]');
        if (open) {
            var cell = open.parentNode, name = open.dataset.pwOpen;
            cell.innerHTML = '<input type="password" autocomplete="new-password" aria-label="New password for ' + esc(name) + '" placeholder="New password" data-pw-input="' + esc(name) + '"> <button type="button" class="btn-primary btn-sm" data-pw-save="' + esc(name) + '">Save</button>';
            cell.querySelector('input').focus();
            return;
        }
        var save = e.target.closest('[data-pw-save]');
        if (save) {
            var inp = root.querySelector('[data-pw-input="' + save.dataset.pwSave + '"]');
            api('PUT', '/api/users/' + encodeURIComponent(save.dataset.pwSave), { password: inp.value }).then(function (j) {
                if (j.error) { say(j.error, true); return; }
                msg = 'Password changed. That person is signed out.'; load();
            });
            return;
        }
        var del = e.target.closest('[data-del]');
        if (del) {
            if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'Really delete?'; return; }
            api('DELETE', '/api/users/' + encodeURIComponent(del.dataset.del)).then(function (j) {
                if (j.error) { say(j.error, true); return; }
                msg = 'Deleted.'; load();
            });
        }
    });
    render(); load();
})();
