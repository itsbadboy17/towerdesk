/* TowerDesk line charts: a labelled scale on the left, time labels underneath, a faint grid, thin
   lines with a soft area, gaps where a device was unreachable, an optional average line, and a
   hover readout. Drawn as SVG that stretches with the card (strokes keep their width) with the
   text in HTML, so nothing gets squashed. Used for latency and traffic in the device card. */
(function () {
    'use strict';
    window.TowerDesk = window.TowerDesk || {};
    var W = 600, H = 140, TOP = 8, BOTTOM = 2;

    function esc(v) { return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function fmtBps(v) {
        if (v === null || v === undefined) return '–';
        var u = ['bps', 'Kbps', 'Mbps', 'Gbps'], i = 0;
        while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
        return (v < 10 && i ? v.toFixed(1) : Math.round(v)) + ' ' + u[i];
    }
    function fmtMs(v) { return v === null || v === undefined ? '–' : (v < 1 ? '<1' : (v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v)))) + ' ms'; }
    var FORMATS = { bps: fmtBps, ms: fmtMs };

    // 1, 2, 5 or 10 times a power of ten that is at least v.
    function niceMax(v, min) {
        v = Math.max(v || 0, min || 0);
        if (v <= 0) return 1;
        var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p;
        return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
    }
    function ago(sec) {
        if (sec <= 0) return 'now';
        if (sec < 90) return Math.round(sec) + ' s ago';
        var m = Math.round(sec / 60);
        return m + ' min ago';
    }
    function y(v, max) { return (TOP + (1 - Math.min(v, max) / max) * (H - TOP - BOTTOM)).toFixed(1); }

    // Contiguous runs of real values (a null breaks the line). Returns { line, area }.
    function paths(values, max, n) {
        var line = '', area = '', run = [];
        var flush = function () {
            if (!run.length) return;
            line += 'M' + run.map(function (p) { return p[0] + ' ' + p[1]; }).join('L');
            if (run.length > 1) area += 'M' + run[0][0] + ' ' + (H - BOTTOM) + 'L' + run.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'L' + run[run.length - 1][0] + ' ' + (H - BOTTOM) + 'Z';
            run = [];
        };
        values.forEach(function (v, i) {
            if (v === null || v === undefined) { flush(); return; }
            run.push([(i / Math.max(1, n - 1) * W).toFixed(1), y(v, max)]);
        });
        flush();
        return { line: line, area: area };
    }

    // opts: { series: [{ name, color, values, fmt: 'bps'|'ms', fill }], minMax, stepSec, avg, gaps }
    function line(opts) {
        var series = opts.series || [];
        var n = Math.max.apply(null, series.map(function (s) { return s.values.length; }).concat([0]));
        if (n < 2) return '<p class="muted">Collecting readings… the graph appears after a few seconds.</p>';
        series = series.map(function (s) { var pad = n - s.values.length; return Object.assign({}, s, { values: new Array(pad).fill(null).concat(s.values) }); });
        var fmt = FORMATS[series[0].fmt] || fmtBps;
        var peak = 0;
        series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null && v > peak) peak = v; }); });
        var max = niceMax(peak * 1.1, opts.minMax);
        var step = opts.stepSec || 10, spanSec = (n - 1) * step;

        var svg = '<svg class="ch-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">';
        [0, 0.5, 1].forEach(function (f) { var gy = (TOP + f * (H - TOP - BOTTOM)).toFixed(1); svg += '<line class="ch-grid" x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '"/>'; });
        if (opts.gaps) {
            // a red band wherever the first series has no reading: the device did not answer
            var base = series[0].values, i = 0;
            while (i < n) {
                if (base[i] === null) { var j = i; while (j + 1 < n && base[j + 1] === null) j++; svg += '<rect class="ch-gap" x="' + (Math.max(0, i - 0.5) / (n - 1) * W).toFixed(1) + '" y="' + TOP + '" width="' + (((Math.min(n - 1, j + 0.5) - Math.max(0, i - 0.5)) / (n - 1)) * W).toFixed(1) + '" height="' + (H - TOP - BOTTOM) + '"/>'; i = j + 1; } else i++;
            }
        }
        if (opts.avg != null) svg += '<line class="ch-avg" x1="0" x2="' + W + '" y1="' + y(opts.avg, max) + '" y2="' + y(opts.avg, max) + '"/>';
        series.forEach(function (s) {
            var p = paths(s.values, max, n);
            svg += '<path d="' + p.area + '" fill="' + s.color + '" fill-opacity="' + (s.fill == null ? 0.18 : s.fill) + '" stroke="none"/>';
            svg += '<path d="' + p.line + '" class="ch-line" stroke="' + s.color + '" fill="none"/>';
        });
        svg += '</svg>';

        var data = { n: n, step: step, series: series.map(function (s) { return { name: s.name, color: s.color, fmt: s.fmt || 'bps', values: s.values }; }) };
        return '<div class="ch">' +
            '<div class="ch-plot"><div class="ch-y"><span>' + esc(fmt(max)) + '</span><span>' + esc(fmt(max / 2)) + '</span><span>0</span></div>' +
            '<div class="ch-area" data-ch="' + esc(JSON.stringify(data)) + '">' + svg + '<div class="ch-hover" hidden></div><div class="ch-tip" hidden></div>' +
            (opts.avg != null ? '<span class="ch-avg-label">average ' + esc(fmt(opts.avg)) + '</span>' : '') + '</div></div>' +
            '<div class="ch-x"><span>' + esc(ago(spanSec)) + '</span><span>' + esc(ago(spanSec / 2)) + '</span><span>now</span></div></div>';
    }

    // Hover readout: a vertical guide and a small box with the time and each series' value.
    function show(area, clientX) {
        var data;
        try { data = JSON.parse(area.getAttribute('data-ch')); } catch (e) { return; }
        var r = area.getBoundingClientRect();
        if (r.width <= 0) return;
        var f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        var i = Math.round(f * (data.n - 1));
        var hover = area.querySelector('.ch-hover'), tip = area.querySelector('.ch-tip');
        var x = (i / (data.n - 1)) * r.width;
        hover.hidden = false; hover.style.left = x + 'px';
        var rows = data.series.map(function (s) {
            var v = s.values[i];
            return '<div><span class="ch-dot" style="background:' + esc(s.color) + '"></span>' + esc(s.name) + ' <b>' + esc((FORMATS[s.fmt] || fmtBps)(v)) + '</b></div>';
        }).join('');
        tip.innerHTML = '<div class="ch-tip-time">' + esc(ago((data.n - 1 - i) * data.step)) + '</div>' + rows;
        tip.hidden = false;
        tip.style.left = (x > r.width * 0.6 ? x - tip.offsetWidth - 10 : x + 10) + 'px';
    }
    function hide(area) {
        var h = area.querySelector('.ch-hover'), t = area.querySelector('.ch-tip');
        if (h) h.hidden = true;
        if (t) t.hidden = true;
    }
    document.addEventListener('pointermove', function (e) {
        var a = e.target.closest && e.target.closest('.ch-area');
        document.querySelectorAll('.ch-area').forEach(function (x) { if (x !== a) hide(x); });
        if (a) show(a, e.clientX);
    });
    document.addEventListener('pointerleave', function () { document.querySelectorAll('.ch-area').forEach(hide); }, true);

    window.TowerDesk.charts = { line: line, niceMax: niceMax, fmtBps: fmtBps, fmtMs: fmtMs };
})();
