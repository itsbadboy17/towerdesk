// Setting up a radio: the templates, the checks on what is typed, and how a template maps onto each brand's
// settings. Pure functions shared by the page and the server (tested in Node). Nothing here talks to a radio.
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.provisionModel = api; }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Characters allowed in what is typed. Kept narrow on purpose: these end up in a command on the radio, so
    // quotes, backslashes, slashes, pipes, dollar signs and spaces in keys are not accepted.
    var SSID_RE = /^[A-Za-z0-9 ._-]{1,32}$/;
    var WPA_RE = /^[A-Za-z0-9._@#%+=:,!^*()-]{8,63}$/;
    var NAME_RE = /^[A-Za-z0-9._-]{1,32}$/;
    var MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    var WIDTHS = [5, 10, 20, 30, 40, 80];

    // mode: 'ap' (a sector, or the master end of a link) or 'sta' (a customer radio, or the slave end).
    var TEMPLATES = {
        sector: { label: 'Sector (access point)', about: 'Serves many customer radios. Sets the name, the Wi-Fi name and password, and the channel.', mode: 'ap', fields: ['name', 'ssid', 'wpaKey', 'frequency', 'channelWidth', 'txPower'] },
        customer: { label: 'Customer radio', about: 'Connects to one of your sectors. Sets the name, the sector’s Wi-Fi name and password, and can lock it to that sector.', mode: 'sta', fields: ['name', 'ssid', 'wpaKey', 'lockAp'] },
        ptpMaster: { label: 'Point-to-point: master end', about: 'The end that creates the link. Set this one first.', mode: 'ap', fields: ['name', 'ssid', 'wpaKey', 'frequency', 'channelWidth', 'txPower'] },
        ptpSlave: { label: 'Point-to-point: slave end', about: 'The end that joins the master. It follows the master’s channel.', mode: 'sta', fields: ['name', 'ssid', 'wpaKey', 'lockAp'] }
    };

    var FIELDS = {
        name: { label: 'Device name', hint: 'Letters, numbers, dot, dash, underscore (up to 32).', required: true },
        ssid: { label: 'Wi-Fi name (SSID)', hint: 'Letters, numbers, space, dot, dash, underscore (up to 32).', required: true },
        wpaKey: { label: 'Wi-Fi password', hint: '8 to 63 characters: letters, numbers and . _ @ # % + = : , ! ^ * ( ) -', required: true, secret: true },
        frequency: { label: 'Frequency (MHz)', hint: 'For example 5180 to 5825.', required: false, numeric: true },
        channelWidth: { label: 'Channel width (MHz)', hint: '20 or 40 are the usual choices.', required: false, numeric: true },
        txPower: { label: 'Transmit power (dBm)', hint: '0 to 30. Lower is quieter for your other radios.', required: false, numeric: true },
        lockAp: { label: 'Lock to this sector (its MAC address)', hint: 'For example 78:8A:20:AA:BB:CC. Leave empty to join any sector with that Wi-Fi name.', required: false }
    };

    // { ok, errors: { field: message }, clean: { field: value } }. A field that is not part of the template is ignored.
    function validate(templateKey, values) {
        var t = TEMPLATES[templateKey];
        var out = { ok: false, errors: {}, clean: {} };
        if (!t) { out.errors._ = 'Choose what this radio will be.'; return out; }
        values = values || {};
        t.fields.forEach(function (f) {
            var v = values[f] === undefined || values[f] === null ? '' : String(values[f]).trim();
            if (!v) { if (FIELDS[f].required) out.errors[f] = 'Required.'; return; }
            if (f === 'name' && !NAME_RE.test(v)) out.errors[f] = 'Use letters, numbers, dot, dash or underscore, up to 32.';
            else if (f === 'ssid' && !SSID_RE.test(v)) out.errors[f] = 'Use letters, numbers, space, dot, dash or underscore, up to 32.';
            else if (f === 'wpaKey' && !WPA_RE.test(v)) out.errors[f] = 'Use 8 to 63 of: letters, numbers and . _ @ # % + = : , ! ^ * ( ) -';
            else if (f === 'lockAp' && !MAC_RE.test(v)) out.errors[f] = 'A MAC address looks like 78:8A:20:AA:BB:CC.';
            else if (f === 'frequency') { var n = Number(v); if (!(Number.isInteger(n) && n >= 2312 && n <= 6100)) out.errors[f] = 'A whole number of MHz, for example 5180.'; else v = n; }
            else if (f === 'channelWidth') { var w = Number(v); if (WIDTHS.indexOf(w) < 0) out.errors[f] = 'One of ' + WIDTHS.join(', ') + '.'; else v = w; }
            else if (f === 'txPower') { var p = Number(v); if (!(Number.isInteger(p) && p >= 0 && p <= 30)) out.errors[f] = 'A whole number from 0 to 30.'; else v = p; }
            if (!out.errors[f]) out.clean[f] = v;
        });
        out.ok = Object.keys(out.errors).length === 0;
        return out;
    }

    // ---------------- Ubiquiti airOS: template -> system.cfg keys ----------------
    // Only these keys can ever be written (the server checks the same list). A key the radio does not already have is
    // never added: the preview reports it and leaves it alone.
    var AIROS_KEYS = {
        name: ['resolv.host.1.name'],
        ssid: ['wireless.1.ssid', 'aaa.1.ssid'],
        wpaKey: ['aaa.1.wpa.psk'],
        frequency: ['radio.1.freq'],
        channelWidth: ['radio.1.chanbw'],
        txPower: ['radio.1.txpower'],
        lockAp: ['wireless.1.ap']
    };
    var AIROS_MODE_KEY = 'radio.1.mode';
    var AIROS_MODE = { ap: 'Master', sta: 'Managed' };
    var AIROS_ALLOWED = Object.keys(AIROS_KEYS).reduce(function (a, k) { return a.concat(AIROS_KEYS[k]); }, [AIROS_MODE_KEY]);
    var SECRET_KEYS = { 'aaa.1.wpa.psk': 1 };

    // Desired key/value pairs (strings) for a validated template. clean = validate(...).clean
    function airosDesired(templateKey, clean) {
        var t = TEMPLATES[templateKey];
        var want = [];
        want.push({ key: AIROS_MODE_KEY, field: 'mode', label: 'Role', value: AIROS_MODE[t.mode], show: t.mode === 'ap' ? 'Access point (master)' : 'Station (client)' });
        t.fields.forEach(function (f) {
            if (clean[f] === undefined) return;
            AIROS_KEYS[f].forEach(function (k) { want.push({ key: k, field: f, label: FIELDS[f].label, value: String(clean[f]), secret: !!SECRET_KEYS[k] }); });
        });
        return want;
    }

    // Compare what the radio has (cfg: key -> value) with what the template wants.
    // status: 'change' | 'same' | 'missing' (the radio has no such setting, so it is left alone)
    function airosPlan(templateKey, clean, cfg) {
        cfg = cfg || {};
        var rows = airosDesired(templateKey, clean).map(function (w) {
            var has = Object.prototype.hasOwnProperty.call(cfg, w.key);
            var from = has ? cfg[w.key] : null;
            var status = !has ? 'missing' : (String(from) === w.value ? 'same' : 'change');
            return { key: w.key, field: w.field, label: w.label, from: w.secret ? (has ? '••••••••' : null) : from, to: w.secret ? '••••••••' : (w.show || w.value), value: w.value, secret: !!w.secret, status: status };
        });
        // Several keys can carry one field (the SSID is in two places): the field is "missing" only if none exist.
        var byField = {};
        rows.forEach(function (r) { (byField[r.field] = byField[r.field] || []).push(r); });
        var problems = [];
        Object.keys(byField).forEach(function (f) { if (byField[f].every(function (r) { return r.status === 'missing'; })) problems.push((FIELDS[f] ? FIELDS[f].label : f) + ': this radio has no such setting in its config, so it will not be changed. Set it once on the radio\'s own page (for the Wi-Fi password: turn WPA2 on there first).'); });
        return { rows: rows, changes: rows.filter(function (r) { return r.status === 'change'; }), problems: problems };
    }

    // ---------------- MikroTik wireless: the commands that would run (preview only for now) ----------------
    function mikrotikPreview(templateKey, clean) {
        var t = TEMPLATES[templateKey];
        var lines = [];
        if (clean.name) lines.push('/system identity set name="' + clean.name + '"');
        if (clean.wpaKey) lines.push('/interface wireless security-profiles set [find name=towerdesk] mode=dynamic-keys authentication-types=wpa2-psk wpa2-pre-shared-key="' + '••••••••' + '"');
        var set = ['mode=' + (t.mode === 'ap' ? 'ap-bridge' : 'station')];
        if (clean.ssid) set.push('ssid="' + clean.ssid + '"');
        if (clean.frequency) set.push('frequency=' + clean.frequency);
        if (clean.channelWidth) set.push('channel-width=' + clean.channelWidth + 'mhz');
        if (clean.txPower !== undefined) set.push('tx-power=' + clean.txPower + ' tx-power-mode=all-rates-fixed');
        if (clean.wpaKey) set.push('security-profile=towerdesk');
        lines.push('/interface wireless set [find default-name=wlan1] ' + set.join(' '));
        return lines;
    }

    // ---------------- "Set up a device": what can be set up, and the steps each one takes ----------------
    // 'mac' is a new MikroTik with no IP yet (found through a MikroTik that can see it); the others are the radio
    // templates above, for a radio that already answers at an IP address.
    var KINDS = [{ key: 'mac', label: 'New MikroTik router', about: 'Just plugged in, with no IP address yet. TowerDesk finds it through a MikroTik you already have, gives it an address and turns on its API.' }]
        .concat(Object.keys(TEMPLATES).map(function (k) { return { key: k, label: TEMPLATES[k].label, about: TEMPLATES[k].about }; }));
    var STEP_TITLES = { kind: 'What it is', relay: 'Where it is plugged in', pick: 'Which one', address: 'Its address', run: 'Check and run', radio: 'Which radio', settings: 'Its settings', apply: 'Check and apply' };
    // The steps, in order, for one kind. Until something is chosen there is only the first step.
    function flow(kind) {
        if (kind === 'mac') return ['kind', 'relay', 'pick', 'address', 'run'];
        if (Object.prototype.hasOwnProperty.call(TEMPLATES, kind)) return ['kind', 'radio', 'settings', 'apply'];
        return ['kind'];
    }

    return { KINDS: KINDS, STEP_TITLES: STEP_TITLES, flow: flow, TEMPLATES: TEMPLATES, FIELDS: FIELDS, validate: validate, airosDesired: airosDesired, airosPlan: airosPlan, mikrotikPreview: mikrotikPreview, AIROS_ALLOWED: AIROS_ALLOWED, SECRET_KEYS: SECRET_KEYS, AIROS_MODE_KEY: AIROS_MODE_KEY };
}));
