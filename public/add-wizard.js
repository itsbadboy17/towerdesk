// Guided Add Device: the same form, one step at a time, in plain words. It adds no new way to talk to
// devices: it shows and hides parts of the existing form and presses the existing Auto-detect and Test
// buttons. "Show everything at once" returns to the full form (remembered in this browser).
(function () {
    'use strict';
    var form = document.getElementById('device-form');
    if (!form) return;
    var $ = function (id) { return document.getElementById(id); };
    var KEY = 'td-add-guided';
    function pref() { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
    function setPref(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* optional */ } }

    var grp = function (id) { return $(id).closest('.form-group'); };
    // Which part of the form belongs to which step.
    var parts = {
        1: [grp('device-ip'), grp('device-type')],
        2: [grp('device-method'), document.querySelector('[data-for="port"]'), document.querySelector('[data-for="login"]'), document.querySelector('[data-for="community"]'), $('method-hint')],
        3: [],
        4: [grp('device-name'), grp('device-location')]
    };
    var TITLES = ['Find the device', 'How to connect', 'Check it works', 'Name it and add it'];
    var INTRO = [
        'Type the IP address. Press <strong>Auto-detect</strong> if you like: TowerDesk looks at the device and works out what it is, and whether one of your saved logins opens it.',
        'TowerDesk picks a way to connect from what it found. Saved logins are tried for you, so you usually only change this if you know the device better. It only reads from the device and never changes anything on it.',
        'Press <strong>Test connection</strong>. The answer appears on the right. If it fails, go back one step and change how to connect. You can still add the device and fix it later.',
        'Give it a name you will recognise, say where it is (this groups it on a site in Topology), then add it.'
    ];
    var step = 1, guided = false, nav, head, intro;

    function build() {
        head = document.createElement('ol');
        head.className = 'wz-steps';
        head.innerHTML = TITLES.map(function (t, i) { return '<li><button type="button" data-wz-go="' + (i + 1) + '"><span class="wz-n">' + (i + 1) + '</span>' + t + '</button></li>'; }).join('');
        intro = document.createElement('p');
        intro.className = 'wz-intro';
        nav = document.createElement('div');
        nav.className = 'wz-nav';
        nav.innerHTML = '<button type="button" class="btn-secondary" data-wz="back">Back</button><button type="button" class="btn-primary" data-wz="next">Next</button><span class="muted" id="wz-msg" role="status"></span>';
        form.insertBefore(intro, form.firstChild);
        form.insertBefore(head, form.firstChild);
        form.appendChild(nav);
        var toggle = document.createElement('button');
        toggle.type = 'button'; toggle.className = 'link-btn wz-toggle'; toggle.id = 'wz-toggle';
        form.parentNode.insertBefore(toggle, form);
        toggle.addEventListener('click', function () { guided = !guided; setPref(guided); apply(); });
    }

    function msg(t) { var el = $('wz-msg'); if (el) el.textContent = t || ''; }

    function apply() {
        form.classList.toggle('wizard', guided);
        $('wz-toggle').textContent = guided ? 'Show everything at once' : 'Use the step-by-step guide';
        head.hidden = intro.hidden = nav.hidden = !guided;
        Object.keys(parts).forEach(function (k) {
            parts[k].forEach(function (el) { if (el) el.classList.toggle('wz-off', guided && Number(k) !== step); });
        });
        // Rows whose every field is off for this step disappear with them (CSS :has).
        for (var s = 1; s <= 4; s++) form.classList.toggle('wz-step-' + s, guided && step === s);
        if (!guided) return;
        intro.innerHTML = '<strong>Step ' + step + ' of 4.</strong> ' + INTRO[step - 1];
        Array.prototype.forEach.call(head.querySelectorAll('li'), function (li, i) { li.classList.toggle('on', i + 1 === step); li.classList.toggle('done', i + 1 < step); });
        nav.querySelector('[data-wz=back]').hidden = step === 1;
        nav.querySelector('[data-wz=next]').hidden = step === 4;
        nav.querySelector('[data-wz=next]').textContent = ['Next: how to connect', 'Next: check it', 'Next: name it', ''][step - 1];
        msg('');
    }

    function go(n) {
        if (n < 1 || n > 4) return;
        // Moving forward from step 1 needs an address; the first time, ask TowerDesk to look at the device.
        if (n > 1 && step === 1) {
            var ip = $('device-ip').value.trim();
            if (!ip) { msg('Type the IP address first.'); $('device-ip').focus(); return; }
            if (form.dataset.wzDetected !== ip && !$('device-type').value) { form.dataset.wzDetected = ip; $('detect-btn').click(); }
        }
        step = n;
        apply();
        var first = form.querySelector('.form-group:not(.wz-off) input, .form-group:not(.wz-off) select');
        if (first && n !== 3) first.focus();
    }

    function init() {
        build();
        guided = pref();
        apply();
        nav.addEventListener('click', function (e) {
            var b = e.target.closest('[data-wz]');
            if (!b) return;
            go(step + (b.dataset.wz === 'next' ? 1 : -1));
        });
        head.addEventListener('click', function (e) {
            var b = e.target.closest('[data-wz-go]');
            if (b) go(Number(b.dataset.wzGo));
        });
        // Enter means "Next" until the last step, so a half-filled form is never submitted by accident.
        form.addEventListener('keydown', function (e) {
            if (guided && step < 4 && e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); go(step + 1); }
        });
        // After a device is added (or the form is cleared) start again at the first step.
        form.addEventListener('reset', function () { setTimeout(function () { step = 1; delete form.dataset.wzDetected; apply(); }, 0); });
        // Auto-detect found a type: say so, so nobody wonders why a field changed.
        $('device-type').addEventListener('change', function () { if (guided && step === 1) msg(''); });
    }
    init();
})();
