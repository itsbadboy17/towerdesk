/* TowerDesk shared page shell: theme, language/RTL, mobile sidebar drawer, active nav. */
(function () {
    'use strict';

    var root = document.documentElement;

    function readPref(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function writePref(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
    }

    // ----- Theme -----
    function applyTheme(theme) {
        root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    }
    applyTheme(readPref('theme'));

    // ----- Design (a testing switch: A is the normal look, B is "Blueprint") -----
    // B lives in its own stylesheet that is only loaded when chosen, so A is never affected. Remembered in
    // this browser (td-design); a ?design=b link forces it for the page.
    var DESIGNS = { a: 'Design A', b: 'Design B' };
    function applyDesign(d) {
        d = DESIGNS[d] ? d : 'a';
        root.setAttribute('data-design', d);
        var link = document.getElementById('td-design-css');
        if (d === 'b' && !link) {
            link = document.createElement('link');
            link.id = 'td-design-css'; link.rel = 'stylesheet'; link.href = '/design-b.css';
            document.head.appendChild(link);
        } else if (d !== 'b' && link) link.remove();
        return d;
    }
    var qd = /[?&]design=([ab])\b/.exec(location.search);
    var design = applyDesign(qd ? qd[1] : readPref('td-design'));
    window.TowerDesk = window.TowerDesk || {};
    window.TowerDesk.design = design;

    // ----- Language / direction -----
    function applyLang(lang) {
        lang = lang === 'ar' ? 'ar' : 'en';
        root.lang = lang;
        root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    applyLang(readPref('lang'));

    // ----- Line-icon set (replaces the emoji that made the UI look templated) -----
    function svgIcon(inner) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
    }
    var ICONS = {
        overview: '<rect x="3" y="3" width="7" height="8" rx="1.3"/><rect x="14" y="3" width="7" height="5" rx="1.3"/><rect x="14" y="11" width="7" height="10" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/>',
        monitoring: '<path d="M3 12h3.5l2-6 3.5 13 3-9 1.8 4H21"/>',
        map: '<path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3Z"/><path d="M9 3v15M15 6v15"/>',
        alerts: '<path d="M10.3 3.9a2 2 0 0 1 3.4 0l7.3 12.7a2 2 0 0 1-1.7 3H4.7a2 2 0 0 1-1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
        remote: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
        add: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12h7M12 8.5v7"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        plans: '<path d="M11.1 2.6a2 2 0 0 1 1.8 0l8 4a1 1 0 0 1 0 1.8l-8 4a2 2 0 0 1-1.8 0l-8-4a1 1 0 0 1 0-1.8Z"/><path d="M3 12l8 4a2 2 0 0 0 2 0l8-4M3 17l8 4a2 2 0 0 0 2 0l8-4"/>',
        voucher: '<path d="M3 9a2 2 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 0 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
        billing: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
        invoice: '<path d="M5 2v20l2-1.3L9 22l2-1.3L13 22l2-1.3L17 22l2-1.3V2l-2 1.3L15 2l-2 1.3L11 2 9 3.3 7 2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
        ticket: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a6 6 0 0 1-7.8 7.8l-6.3 6.3a2.1 2.1 0 0 1-3-3l6.3-6.3a6 6 0 0 1 7.8-7.8l-3.1 3.1Z"/>',
        bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 2.6V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.1 1.6Z"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        topology: '<rect x="9" y="2.5" width="6" height="5" rx="1.2"/><rect x="2.5" y="16.5" width="6" height="5" rx="1.2"/><rect x="15.5" y="16.5" width="6" height="5" rx="1.2"/><path d="M12 7.5V12M5.5 16.5V12h13v4.5"/>'
    };
    var NAV_ICON = {
        '/': 'overview', '/monitoring': 'monitoring', '/topology': 'topology', '/map': 'map', '/alerts': 'alerts',
        '/remote': 'remote', '/add-device': 'add', '/sas': 'users', '/plans': 'plans',
        '/vouchers': 'voucher', '/billing': 'billing', '/invoices': 'invoice', '/tickets': 'ticket', '/finance': 'billing'
    };
    window.TowerDesk = window.TowerDesk || {};
    window.TowerDesk.icon = function (name) { return ICONS[name] ? svgIcon(ICONS[name]) : ''; };

    // ----- Real data / demo data -----
    // One switch for the whole app. Demo shows a sample tower so features can be tried without
    // touching the real network. It is remembered in this browser (td-demo); a ?demo=1 link
    // forces it on. Pages read window.TowerDesk.demo instead of working it out themselves.
    var DEMO_ON = /[?&]demo(=1|=true|&|$)/.test(location.search) || readPref('td-demo') === '1';
    window.TowerDesk.demo = DEMO_ON;
    if (DEMO_ON) root.setAttribute('data-demo', '1');

    function applyIcons() {
        document.querySelectorAll('.nav-section a').forEach(function (a) {
            var key = NAV_ICON[a.getAttribute('href')];
            var span = a.querySelector('.nav-icon');
            if (key && span) span.innerHTML = svgIcon(ICONS[key]);
        });
        // User-card buttons (Settings / Sign out).
        document.querySelectorAll('.nav-link-btn').forEach(function (b) {
            var span = b.querySelector('.nav-icon');
            if (span) span.innerHTML = svgIcon(/sign out/i.test(b.textContent) ? ICONS.logout : ICONS.gear);
        });
        var bell = document.querySelector('.topbar a[href="/alerts"]');
        if (bell) { bell.innerHTML = svgIcon(ICONS.bell); bell.classList.add('icon-btn'); }
    }

    // Pages added after the sidebar markup was written are linked from here, so the thirteen page
    // files do not each need editing.
    function addNavLinks() {
        var after = document.querySelector('.nav-section a[href="/monitoring"]');
        if (after && !document.querySelector('.nav-section a[href="/topology"]')) {
            var li = document.createElement('li');
            li.innerHTML = '<a href="/topology"><span class="nav-icon" aria-hidden="true"></span>Topology</a>';
            after.parentNode.parentNode.insertBefore(li, after.parentNode.nextSibling);
        }
        // Finance sits under Customers, after SAS (shown to admins only: see the role handling below).
        var sas = document.querySelector('.nav-section a[href="/sas"]');
        if (sas && !document.querySelector('.nav-section a[href="/finance"]')) {
            var fi = document.createElement('li');
            fi.innerHTML = '<a href="/finance"><span class="nav-icon" aria-hidden="true"></span>Finance</a>';
            sas.parentNode.parentNode.insertBefore(fi, sas.parentNode.nextSibling);
        }
    }

    // Arabic interface text lives in /i18n.js and is fetched only when Arabic is chosen.
    function translate() {
        var i18n = window.TowerDesk.i18n;
        if (i18n) { i18n.apply(root.lang); return; }
        if (root.lang !== 'ar' || document.getElementById('td-i18n')) return;
        var s = document.createElement('script');
        s.id = 'td-i18n';
        s.src = '/i18n.js';
        document.head.appendChild(s); // applies itself once loaded
    }

    function init() {
        var body = document.body;
        addNavLinks();
        applyIcons();
        var sidebar = document.querySelector('.sidebar');
        var topbar = document.querySelector('.topbar');

        // ----- Active nav link -----
        var path = location.pathname.replace(/\/+$/, '') || '/';
        var aliases = { '/dashboard': '/', '/subscribers': '/sas' };
        var current = aliases[path] || path;
        document.querySelectorAll('.nav-section a').forEach(function (a) {
            var isActive = a.getAttribute('href') === current;
            a.classList.toggle('active', isActive);
            if (isActive) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });

        if (topbar) {
            var right = topbar.querySelector('.right');
            if (!right) {
                right = document.createElement('div');
                right.className = 'right';
                topbar.appendChild(right);
            }

            // Language selector
            var lang = document.createElement('select');
            lang.id = 'language-selector';
            lang.className = 'lang-select';
            lang.setAttribute('aria-label', 'Language');
            lang.innerHTML = '<option value="en">EN</option><option value="ar">AR</option>';
            lang.value = root.lang === 'ar' ? 'ar' : 'en';
            lang.addEventListener('change', function () {
                applyLang(lang.value);
                writePref('lang', lang.value);
                translate();
            });
            right.insertBefore(lang, right.firstChild);

            // Design switch, right next to the language selector
            var designSel = document.createElement('select');
            designSel.id = 'design-selector';
            designSel.className = 'lang-select design-select';
            designSel.setAttribute('aria-label', 'Design');
            designSel.title = 'Try a different look (for testing)';
            designSel.innerHTML = Object.keys(DESIGNS).map(function (k) { return '<option value="' + k + '">' + DESIGNS[k] + '</option>'; }).join('');
            designSel.value = design;
            designSel.addEventListener('change', function () {
                writePref('td-design', designSel.value);
                applyDesign(designSel.value);
            });
            right.insertBefore(designSel, lang.nextSibling);

            // Theme toggle
            var themeBtn = document.createElement('button');
            themeBtn.type = 'button';
            themeBtn.className = 'icon-btn theme-toggle';
            var syncThemeBtn = function () {
                var dark = root.getAttribute('data-theme') === 'dark';
                themeBtn.innerHTML = svgIcon(dark ? ICONS.sun : ICONS.moon);
                themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
                themeBtn.title = themeBtn.getAttribute('aria-label');
            };
            syncThemeBtn();
            themeBtn.addEventListener('click', function () {
                var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                applyTheme(next);
                writePref('theme', next);
                syncThemeBtn();
            });
            right.insertBefore(themeBtn, designSel.nextSibling);

            // Real data / demo data switch, next to the language selector
            var demoBtn = document.createElement('button');
            demoBtn.type = 'button';
            demoBtn.id = 'demo-toggle';
            demoBtn.className = 'demo-toggle' + (DEMO_ON ? ' is-demo' : '');
            demoBtn.setAttribute('aria-pressed', DEMO_ON ? 'true' : 'false');
            demoBtn.innerHTML = '<span class="demo-dot" aria-hidden="true"></span><span class="demo-label"></span>';
            demoBtn.querySelector('.demo-label').textContent = DEMO_ON ? 'Demo data' : 'Real data';
            demoBtn.title = DEMO_ON ? 'Showing a sample tower. Click to go back to your real data.' : 'Showing your real data. Click to switch to a sample tower for testing.';
            demoBtn.addEventListener('click', function () {
                writePref('td-demo', DEMO_ON ? '0' : '1');
                var u = new URL(location.href);
                // Going to demo also says so in the address (a fallback if the browser cannot
                // remember it); going back to real removes it so the page cannot stay in demo.
                if (DEMO_ON) u.searchParams.delete('demo'); else u.searchParams.set('demo', '1');
                location.replace(u.toString());
            });
            right.insertBefore(demoBtn, right.firstChild);

            // While demo is on, say so on every page so it can never be mistaken for real data.
            // (The header is fixed to the top, so the notice goes first inside the page content.)
            var mainEl = document.querySelector('.main');
            if (DEMO_ON && mainEl) {
                var note = document.createElement('div');
                note.className = 'demo-banner';
                note.setAttribute('role', 'status');
                note.textContent = 'Demo data: a sample tower for testing. Nothing here changes your real devices. Add Device, Alerts and Settings still use your real setup.';
                mainEl.insertBefore(note, mainEl.firstChild);
            }

            // Mobile menu toggle (link to the sidebar so it still works as an anchor)
            if (sidebar) {
                if (!sidebar.id) sidebar.id = 'sidebar';
                var menu = document.createElement('a');
                menu.href = '#' + sidebar.id;
                menu.className = 'menu-btn';
                menu.setAttribute('role', 'button');
                menu.setAttribute('aria-controls', sidebar.id);
                menu.setAttribute('aria-expanded', 'false');
                menu.setAttribute('aria-label', 'Open navigation menu');
                menu.innerHTML = svgIcon(ICONS.menu);
                topbar.insertBefore(menu, topbar.firstChild);

                var backdrop = document.createElement('div');
                backdrop.className = 'sidebar-backdrop';
                body.appendChild(backdrop);

                var setOpen = function (open) {
                    body.classList.toggle('sidebar-open', open);
                    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
                    menu.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
                };
                var toggle = function (e) {
                    e.preventDefault();
                    setOpen(!body.classList.contains('sidebar-open'));
                };
                menu.addEventListener('click', toggle);
                menu.addEventListener('keydown', function (e) {
                    if (e.key === ' ') toggle(e);
                });
                backdrop.addEventListener('click', function () { setOpen(false); });
                document.addEventListener('keydown', function (e) {
                    if (e.key === 'Escape') setOpen(false);
                });
                sidebar.addEventListener('click', function (e) {
                    if (e.target.closest('a')) setOpen(false);
                });
                window.matchMedia('(min-width: 901px)').addEventListener('change', function (mq) {
                    if (mq.matches) setOpen(false);
                });
            }
        }

        // Who is signed in and what they may do. The server enforces it; this only hides what would be refused.
        if (window.fetch) {
            window.TowerDesk.session = fetch('/api/session').then(function (r) { return r.json(); }).then(function (s) {
                var role = s.role || 'admin';
                document.documentElement.setAttribute('data-role', role);
                var hide = function (sel) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (a) { var li = a.closest('li'); (li || a).hidden = true; }); };
                if (role !== 'admin') hide('a[href="/settings"], a[href="/finance"]');
                if (role === 'viewer') hide('a[href="/add-device"]');
                window.TowerDesk.role = role;
                // Quick search (Ctrl+K) on every page except the sign-in page.
                if (location.pathname !== '/login' && !document.getElementById('td-qs')) { var qs = document.createElement('script'); qs.id = 'td-qs'; qs.src = '/quick-search.js'; document.head.appendChild(qs); }
                return s;
            }).catch(function () { return { role: 'admin' }; });
        }

        // Sign Out (only meaningful once a login has been configured on the server).
        var signOut = Array.prototype.filter.call(document.querySelectorAll('.nav-link-btn'), function (b) {
            return /sign out/i.test(b.textContent);
        })[0];
        if (signOut && window.fetch) {
            fetch('/api/session').then(function (r) { return r.json(); }).then(function (s) {
                if (!s.authRequired) return;
                if (s.user) {
                    var name = document.querySelector('.user-card .user-name');
                    if (name) name.textContent = s.user;
                }
                signOut.addEventListener('click', function () {
                    fetch('/api/logout', { method: 'POST' }).then(function () { location.href = '/login'; });
                });
            }).catch(function () { /* offline or older server */ });
        }

        // Alert bell: live count badge + desktop notification for new alerts.
        var bell = document.querySelector('.topbar a[href="/alerts"]');
        if (bell && window.fetch) {
            var badge = document.createElement('span');
            badge.className = 'bell-badge';
            badge.hidden = true;
            bell.classList.add('has-badge');
            bell.appendChild(badge);
            var notified = {};
            try { notified = JSON.parse(sessionStorage.getItem('td-notified') || '{}'); } catch (e) { notified = {}; }
            var pollAlerts = function () {
                if (document.hidden) return;
                fetch('/api/alerts/summary').then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
                    if (!s) return;
                    badge.hidden = !s.active;
                    badge.textContent = s.active > 99 ? '99+' : String(s.active);
                    badge.className = 'bell-badge' + (s.critical ? ' critical' : '');
                    var label = s.active ? s.active + ' active alert' + (s.active === 1 ? '' : 's') : 'Alerts';
                    bell.setAttribute('aria-label', label);
                    bell.title = label;
                    var l = s.latest;
                    var fresh = l && Date.now() - new Date(l.openedAt).getTime() < 5 * 60 * 1000;
                    if (fresh && !notified[l.id] && 'Notification' in window && Notification.permission === 'granted') {
                        notified[l.id] = 1;
                        try { sessionStorage.setItem('td-notified', JSON.stringify(notified)); } catch (e) { /* ignore */ }
                        var n = new Notification(l.severity === 'critical' ? 'TowerDesk: device down' : 'TowerDesk alert', { body: l.message, tag: l.id });
                        n.onclick = function () { window.focus(); location.href = '/alerts'; };
                    }
                }).catch(function () { /* offline */ });
            };
            pollAlerts();
            setInterval(pollAlerts, 15000);
        }

        translate();

        // Scrollable table regions must be reachable by keyboard.
        document.querySelectorAll('.table-wrap').forEach(function (wrap) {
            wrap.setAttribute('tabindex', '0');
            wrap.setAttribute('role', 'region');
            var card = wrap.closest('.card');
            var heading = card && card.querySelector('.card-header h3');
            wrap.setAttribute('aria-label', heading ? heading.textContent.trim() : 'Table');
        });
    }

    // Inline "Are you sure?" next to a button. Native confirm() dialogs are blocked in some
    // embedded browsers, so this stays on the page. Resolves true on Yes, false on No/timeout.
    window.TowerDesk = window.TowerDesk || {};

    // One place that decides a device's real connection state, so every page uses the same words.
    // "Online" (answers ping) is not the same as having live data (a login or SNMP that works):
    //   monitored : Live data      - logged in (or SNMP) and readings are flowing
    //   connected : Starting…      - the login works; the first readings are still arriving
    //   noData    : No live data   - the login worked once but reading it now fails
    //   reachable : Ping only      - answers ping/web, nothing to log in with, so no signal/traffic
    //   failed    : why the login failed: Wrong login / Not answering / Login closed / Login failed
    //   offline   : Offline        - no reply at all
    //   unknown   : Checking…      - not checked yet
    var AUTH_METHODS = { mikrotik: 1, 'mikrotik-ssl': 1, ssh: 1, telnet: 1, snmp: 1, snmp1: 1, tplink: 1, airos: 1, mimosa: 1 };
    // Why a login test failed, in the owner's words. 'auth' is the only one that means a wrong password.
    window.TowerDesk.loginProblem = function (err) {
        err = String(err || '');
        if (/wrong (user|pass)|password|credential|denied|unauthori|authenticat/i.test(err)) return 'auth';
        if (/timed out|timeout|filtered|no reply|no snmp/i.test(err)) return 'timeout';
        if (/refused|closed|disabled/i.test(err)) return 'refused';
        return 'other';
    };
    var PROBLEMS = {
        auth: { label: 'Wrong login', hint: 'The device answered but rejected the saved username/password. Open the device and press Connect to enter the right one.' },
        timeout: { label: 'Not answering', hint: 'Ping works, but the login page did not answer in time. This is not a wrong password: the device may be overloaded, or the link to it is unstable (lost packets).' },
        refused: { label: 'Login closed', hint: 'The device refused the connection: that service is switched off or uses another port.' },
        other: { label: 'Login failed', hint: 'The device answers ping, but the chosen connection method did not work.' }
    };
    window.TowerDesk.connState = function (d) {
        var online = d.online;
        if (online === undefined || online === null) online = d.status ? d.status.online : online;
        var test = d.lastTest || null;
        var auth = !!AUTH_METHODS[d.method];
        var mx = d.metrics;
        // Live data = traffic counters flowing, or (for devices with none) other readings arriving.
        var hasData = !!(mx && !mx.error && ((!mx.waiting && mx.interfaces && mx.interfaces.length) || (mx.lastPoll && (mx.signal != null || mx.stationCount != null || mx.cpu || mx.onuCount != null))));
        if (d.unreachable) return { key: 'unknown', label: 'Unreachable', badge: 'warning', hint: 'Nothing on this device\'s network answers — the VPN may be closed. Its real status is unknown.' };
        if (online === false) return { key: 'offline', label: 'Offline', badge: 'critical', hint: 'No reply to ping or the management port.' };
        if (online === null || online === undefined) return { key: 'unknown', label: 'Checking…', badge: 'warning', hint: 'Not checked yet.' };
        if (test && test.ok === false) {
            var p = PROBLEMS[window.TowerDesk.loginProblem(test.error)];
            return { key: 'failed', label: p.label, badge: 'warning', hint: p.hint + (test.error ? ' (' + test.error + ')' : '') };
        }
        if (auth && (!test || test.ok)) {
            if (hasData) return { key: 'monitored', label: 'Live data', badge: 'healthy', hint: 'Logged in and collecting live data (signal, traffic).' };
            if (mx && mx.error) return { key: 'noData', label: 'No live data', badge: 'warning', hint: mx.error + ' The login worked before, so this is usually a slow or unstable device.' };
            return { key: 'connected', label: 'Starting…', badge: 'healthy', hint: 'Logged in. Waiting for the first readings (about 20 seconds).' };
        }
        return { key: 'reachable', label: 'Ping only', badge: 'info', hint: 'Only answers ping. TowerDesk has no working login for it, so there is no signal or traffic. Open the device and press Connect.' };
    };

    // ----- Shared formatting helpers for newer pages -----
    function esc(v) {
        return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function scaled(v, units, step) {
        if (v === null || v === undefined) return '–';
        var i = 0;
        while (v >= step && i < units.length - 1) { v /= step; i++; }
        return (v < 10 && i ? v.toFixed(2) : v < 100 && i ? v.toFixed(1) : Math.round(v)) + ' ' + units[i];
    }
    window.TowerDesk.fmt = {
        esc: esc,
        bps: function (v) { return scaled(v, ['bps', 'Kbps', 'Mbps', 'Gbps'], 1000); },
        bytes: function (v) { return scaled(v, ['B', 'KB', 'MB', 'GB', 'TB'], 1024); },
        ago: function (iso) {
            if (!iso) return '';
            var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
            if (s < 60) return s + 's';
            if (s < 3600) return Math.floor(s / 60) + 'm';
            if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
            return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
        }
    };

    // Save a table as a .csv file that opens directly in Excel (UTF-8 with BOM so Arabic names
    // survive). Built in the browser — nothing is sent anywhere.
    window.TowerDesk.exportCsv = function (filename, headers, rows) {
        var cell = function (v) {
            v = v === null || v === undefined ? '' : String(v);
            if (/^[=+\-@]/.test(v)) v = "'" + v; // never let a value be read as a formula
            return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        var text = [headers].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };

    // Ping / traceroute buttons for a host. Returns HTML; clicks are handled once, page-wide.
    // Ping and traceroute from this PC, shown as a readable result (per-packet bars, a summary and a
    // plain verdict) with the raw text kept under "Technical output". The parsing lives in
    // /nettools-model.js, loaded the first time one of these buttons is used.
    window.TowerDesk.netTools = function (host) {
        if (!host) return '';
        return '<div class="net-tools" data-host="' + esc(host) + '">' +
            '<button type="button" class="btn-secondary btn-sm" data-tool="ping" title="Sends 4 small test packets and shows how many come back and how fast">Ping</button>' +
            '<button type="button" class="btn-secondary btn-sm" data-tool="trace" title="Shows each router between this PC and the device">Traceroute</button>' +
            '<div class="net-tools-out" hidden></div></div>';
    };
    function loadNetModel(cb) {
        if (window.TowerDesk.nettools) return cb(window.TowerDesk.nettools);
        var el = document.createElement('script');
        el.src = '/nettools-model.js';
        el.onload = function () { cb(window.TowerDesk.nettools); };
        el.onerror = function () { cb(null); };
        document.head.appendChild(el);
    }
    function ms1(v) { return v === null || v === undefined ? '–' : (v < 1 ? '<1' : (v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v)))) + ' ms'; }
    function rawFold(text) { return '<details class="nt-raw"><summary>Technical output</summary><pre>' + esc(text) + '</pre></details>'; }
    function pingHtml(M, host, text) {
        var r = M.parsePing(text), v = M.pingVerdict(r);
        if (r.error) return '<div class="nt-verdict ' + v.tone + '">' + esc(v.text) + '</div>' + rawFold(text);
        var top = Math.max(20, r.maxMs || 0);
        var chips = '<div class="nt-chips"><span><b>' + r.sent + '</b> sent</span><span><b>' + r.received + '</b> replied</span><span class="' + (r.lost ? 'bad' : '') + '"><b>' + r.lossPct + '%</b> lost</span><span><b>' + ms1(r.avgMs) + '</b> average</span></div>';
        var bars = '<div class="nt-packets" role="img" aria-label="Result of each of the ' + r.sent + ' packets">' + r.replies.map(function (p, i) {
            return '<div class="nt-pk ' + (p.ok ? 'ok' : 'lost') + '"><div class="nt-barwrap"><div class="nt-bar" style="height:' + (p.ok ? Math.max(8, Math.round((p.ms / top) * 100)) : 100) + '%"></div></div><span>' + (p.ok ? esc(ms1(p.ms)) : 'lost') + '</span></div>';
        }).join('') + '</div>';
        return '<div class="nt-title">Ping ' + esc(host) + '</div>' + chips + bars + '<div class="nt-verdict ' + v.tone + '">' + esc(v.text) + '</div>' + rawFold(text);
    }
    function traceHtml(M, host, text) {
        var r = M.parseTrace(text, host), v = M.traceVerdict(r);
        var rows = r.hops.map(function (h) {
            return '<tr class="' + (h.silent ? 'silent' : '') + '"><td>' + h.n + '</td><td class="mono">' + (h.host ? esc(h.host) : '<span class="muted">no answer (some routers never do)</span>') + '</td><td class="mono">' + esc(ms1(h.avgMs)) + '</td></tr>';
        }).join('');
        return '<div class="nt-title">Route to ' + esc(host) + '</div>' + (rows ? '<table class="nt-route"><thead><tr><th>Step</th><th>Router</th><th>Time</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
            '<div class="nt-verdict ' + v.tone + '">' + esc(v.text) + '</div>' + rawFold(text);
    }
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('.net-tools button[data-tool]');
        if (!btn) return;
        var box = btn.closest('.net-tools');
        var out = box.querySelector('.net-tools-out');
        var host = box.dataset.host, tool = btn.dataset.tool;
        out.hidden = false;
        out.innerHTML = '<div class="nt-wait" role="status"><span class="spin" aria-hidden="true"></span> ' + (tool === 'trace' ? 'Tracing the route to ' + esc(host) + '… this can take up to 30 seconds.' : 'Pinging ' + esc(host) + '… sending 4 packets, about 5 seconds.') + '</div>';
        box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        fetch('/api/tools/' + tool, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host: host }) })
            .then(function (r) { return r.json(); })
            .then(function (j) {
                if (!j.output) { out.innerHTML = '<div class="nt-verdict bad">' + esc(j.error || 'No output.') + '</div>'; return; }
                return new Promise(function (resolve) {
                    loadNetModel(function (M) {
                        out.innerHTML = M ? (tool === 'trace' ? traceHtml(M, host, j.output) : pingHtml(M, host, j.output)) : '<pre>' + esc(j.output) + '</pre>';
                        resolve();
                    });
                });
            })
            .catch(function () { out.innerHTML = '<div class="nt-verdict bad">Could not run the command.</div>'; })
            .then(function () { box.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); });
    });

    window.TowerDesk.inlineConfirm = function (button, question) {
        return new Promise(function (resolve) {
            var box = document.createElement('span');
            box.className = 'inline-confirm';
            box.setAttribute('role', 'group');
            box.innerHTML = '<span class="inline-confirm-q"></span>' +
                '<button type="button" class="btn-danger btn-sm" data-answer="yes">Yes</button>' +
                '<button type="button" class="btn-secondary btn-sm" data-answer="no">No</button>';
            box.querySelector('.inline-confirm-q').textContent = question || 'Are you sure?';
            button.hidden = true;
            button.parentNode.insertBefore(box, button.nextSibling);
            var done = function (answer) {
                clearTimeout(timer);
                box.remove();
                button.hidden = false;
                resolve(answer);
            };
            var timer = setTimeout(function () { done(false); }, 10000);
            box.addEventListener('click', function (e) {
                var b = e.target.closest('button[data-answer]');
                if (b) done(b.dataset.answer === 'yes');
            });
            box.querySelector('[data-answer="no"]').focus();
        });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
