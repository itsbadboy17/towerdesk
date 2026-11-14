// Settings > Messages: the optional Telegram bot, and the WhatsApp country code. The token is typed here,
// sent once, kept encrypted on the server and never shown again.
(function () {
    'use strict';
    var root = document.getElementById('notify-body');
    if (!root) return;
    var esc = window.TowerDesk.fmt.esc;
    var cfg = null, msg = '', bad = false;

    function api(method, url, body) {
        return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
            .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }); });
    }
    function say(t, isBad) { msg = t; bad = !!isBad; var el = document.getElementById('nt-msg'); if (el) { el.textContent = (isBad ? '⚠ ' : '') + t; el.className = isBad ? 'live-error' : 'muted'; } }
    function chk(id, label, on) { return '<label class="conn-check"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }

    function render() {
        if (!cfg) { root.innerHTML = '<p class="muted">Loading…</p>'; return; }
        var t = cfg.telegram;
        root.innerHTML =
            '<p class="muted">TowerDesk can post new outages and recoveries to a Telegram chat. This is the only part of TowerDesk that needs the internet, and only when you switch it on. Each message says which customers are affected. WhatsApp is not sent automatically: use <strong>Tell customers</strong> in a device card, which opens your own WhatsApp.</p>' +
            '<details class="status-legend"><summary>How do I set up the Telegram bot?</summary><ol class="nt-steps"><li>In Telegram, open <b>@BotFather</b>, send <code>/newbot</code>, and copy the token it gives you.</li><li>Open your new bot and press <b>Start</b> (or add it to a group).</li><li>Send any message to <b>@userinfobot</b> to see your chat id (a group id starts with a minus sign).</li><li>Paste both below, save, then press <b>Send a test message</b>.</li></ol></details>' +
            '<form id="nt-form" autocomplete="off"><div class="form-row">' +
            '<div class="form-group"><label for="nt-token">Bot token</label><input type="password" id="nt-token" autocomplete="new-password" placeholder="' + (t.hasToken ? 'Saved. Paste a new one to replace it.' : '123456789:AA…') + '"></div>' +
            '<div class="form-group"><label for="nt-chat">Chat id</label><input type="text" id="nt-chat" value="' + esc(t.chatId) + '" placeholder="-1001234567890"></div></div>' +
            '<div class="nt-events">' + chk('nt-down', 'A device stops answering', t.events.down) + chk('nt-rec', 'A device comes back', t.events.recovered) + chk('nt-lat', 'Slow connection (can be noisy)', t.events.latency) + '</div>' +
            '<div class="form-row"><div class="form-group"><label for="nt-cc">Phone country code for WhatsApp</label><input type="text" id="nt-cc" value="' + esc(cfg.whatsapp.countryCode) + '" maxlength="4" inputmode="numeric"><span class="muted">964 for Iraq. Turns 0770… into 964770…</span></div></div>' +
            chk('nt-on', 'Send Telegram messages', t.enabled) +
            '<div class="form-actions"><button type="submit" class="btn-primary">Save</button><button type="button" class="btn-secondary" id="nt-test"' + (t.hasToken ? '' : ' disabled') + '>Send a test message</button>' +
            (t.hasToken ? '<button type="button" class="link-btn" id="nt-clear">Remove the saved token</button>' : '') + '<span id="nt-msg" class="muted" role="status">' + esc(msg) + '</span></div>' +
            (cfg.last ? '<p class="muted">' + esc(cfg.last.text) + '</p>' : '') + '</form>';
    }
    function load() {
        return api('GET', '/api/notify').then(function (j) {
            if (j.status === 403) { root.innerHTML = '<p class="muted">Only an admin can change message settings.</p>'; return; }
            cfg = j; render();
        }).catch(function () { root.innerHTML = '<p class="muted">Could not load the message settings.</p>'; });
    }
    root.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = { chatId: document.getElementById('nt-chat').value.trim(), countryCode: document.getElementById('nt-cc').value.trim(), events: { down: document.getElementById('nt-down').checked, recovered: document.getElementById('nt-rec').checked, latency: document.getElementById('nt-lat').checked } };
        var tok = document.getElementById('nt-token').value.trim();
        if (tok) body.token = tok;
        say('Saving…');
        // Save the details first; switching on is a second step so a rejected token is reported clearly.
        api('POST', '/api/notify/config', body).then(function (j) {
            if (j.error) { say(j.error, true); return; }
            return api('POST', '/api/notify/config', { enabled: document.getElementById('nt-on').checked }).then(function (k) {
                if (k.error) { say(k.error, true); return; }
                msg = 'Saved.'; return load();
            });
        }).catch(function () { say('Could not reach TowerDesk.', true); });
    });
    root.addEventListener('click', function (e) {
        if (e.target.id === 'nt-test') {
            say('Sending…');
            api('POST', '/api/notify/test').then(function (j) { if (j.ok) say('Sent. Check Telegram.'); else say(j.error || 'It did not send.', true); });
        } else if (e.target.id === 'nt-clear') {
            api('POST', '/api/notify/config', { clearToken: true }).then(function () { msg = 'The token was removed.'; load(); });
        }
    });
    render(); load();
})();
