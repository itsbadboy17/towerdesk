/* Turns the raw text of ping and traceroute (Windows or Linux) into something a person can read:
   per-packet results, a summary and a plain-language verdict. Pure functions, no DOM, so they are
   unit-tested in Node. The page keeps the raw text under a "Technical output" fold. */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else { root.TowerDesk = root.TowerDesk || {}; root.TowerDesk.nettools = api; }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';

    function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
    function round1(n) { return Math.round(n * 10) / 10; }

    // { error } | { sent, received, lost, lossPct, minMs, avgMs, maxMs, replies: [{ ok, ms }] }
    function parsePing(text) {
        text = String(text || '');
        if (/could not find host|unknown host|name or service not known|cannot resolve/i.test(text)) return { error: 'That name or address could not be found.' };
        var replies = [], sent = null, received = null, m;
        text.split(/\r?\n/).forEach(function (line) {
            if (/(reply from|bytes from)/i.test(line) && !/unreachable/i.test(line) && (m = /time\s*([=<])\s*([\d.]+)\s*ms/i.exec(line))) {
                replies.push({ ok: true, ms: m[1] === '<' ? 0.5 : num(m[2]) });
            } else if (/request timed out|destination (host|net|port) unreachable|general failure|transmit failed|request timeout/i.test(line)) {
                replies.push({ ok: false });
            }
        });
        if ((m = /sent\s*=\s*(\d+),\s*received\s*=\s*(\d+)/i.exec(text))) { sent = +m[1]; received = +m[2]; }
        else if ((m = /(\d+)\s+packets transmitted,\s*(\d+)\s+(?:packets )?received/i.exec(text))) { sent = +m[1]; received = +m[2]; }
        if (sent === null) { sent = replies.length; received = replies.filter(function (r) { return r.ok; }).length; }
        if (!sent) return { error: 'No result came back from ping.' };
        // Linux prints nothing for a lost packet: pad so every packet has a place on screen.
        while (replies.length < sent) replies.push({ ok: false });
        replies = replies.slice(0, sent);
        var oks = replies.filter(function (r) { return r.ok; }).map(function (r) { return r.ms; });
        var out = { sent: sent, received: received, lost: sent - received, lossPct: Math.round(((sent - received) / sent) * 100), replies: replies, minMs: null, avgMs: null, maxMs: null };
        if (oks.length) {
            out.minMs = Math.min.apply(null, oks); out.maxMs = Math.max.apply(null, oks);
            out.avgMs = round1(oks.reduce(function (a, b) { return a + b; }, 0) / oks.length);
        }
        return out;
    }

    function pingVerdict(r) {
        if (r.error) return { tone: 'bad', text: r.error };
        if (r.received === 0) return { tone: 'bad', text: 'No reply at all. The device is off, or something between here and it is blocking ping.' };
        if (r.lossPct > 0) return { tone: 'warn', text: 'It answers, but ' + r.lossPct + '% of the packets were lost. The link to this device is unstable.' };
        if (r.avgMs > 150) return { tone: 'warn', text: 'Every packet came back, but slowly (about ' + Math.round(r.avgMs) + ' ms). The link is congested or far away.' };
        return { tone: 'good', text: 'Every packet came back, quickly. The device is reachable.' };
    }

    // { target, hops: [{ n, host, times: [ms|null], avgMs, silent }], reached }
    function parseTrace(text, host) {
        text = String(text || '');
        var hops = [], m;
        var tm = /(?:tracing route to|traceroute to)\s+(\S+)/i.exec(text);
        var target = host || (tm ? tm[1] : '');
        text.split(/\r?\n/).forEach(function (line) {
            if (/tracing route|maximum of|trace complete|traceroute to/i.test(line)) return;
            if (!(m = /^\s*(\d{1,2})\s+(.*)$/.exec(line))) return;
            var rest = m[2], times = [], t, re = /(<\s*\d+|\d+(?:\.\d+)?)\s*ms|\*/g;
            while ((t = re.exec(rest))) times.push(t[0] === '*' ? null : (/^</.test(t[1]) ? 0.5 : num(t[1])));
            var ip = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(rest.replace(/<?\s*\d+(?:\.\d+)?\s*ms/g, ''));
            var got = times.filter(function (x) { return x !== null; });
            hops.push({ n: +m[1], host: ip ? ip[1] : null, times: times, avgMs: got.length ? round1(got.reduce(function (a, b) { return a + b; }, 0) / got.length) : null, silent: !got.length });
        });
        var last = hops[hops.length - 1];
        var reached = !!(last && last.host && (last.host === target || /trace complete/i.test(text)) && !last.silent);
        return { target: target, hops: hops, reached: reached };
    }

    function traceVerdict(r) {
        if (!r.hops.length) return { tone: 'bad', text: 'No route information came back.' };
        if (r.reached) return { tone: 'good', text: 'Reached the destination in ' + r.hops.length + ' step' + (r.hops.length === 1 ? '' : 's') + '.' };
        var lastSeen = r.hops.filter(function (h) { return !h.silent; }).pop();
        return { tone: 'warn', text: 'Did not reach the destination' + (lastSeen ? '. The last router that answered was ' + (lastSeen.host || 'step ' + lastSeen.n) + ' (step ' + lastSeen.n + '). The problem is after it.' : '. Nothing along the way answered.') };
    }

    return { parsePing: parsePing, pingVerdict: pingVerdict, parseTrace: parseTrace, traceVerdict: traceVerdict };
});
