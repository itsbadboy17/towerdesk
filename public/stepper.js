// One step-by-step helper for the pages that walk the owner through a task in order ("Set up a device" and "Add a
// device"). The page keeps each step as a <section data-step="id"> inside one element. This helper adds the step chips,
// the line of help under them and the Back / Next buttons, shows one step at a time, and checks a step before leaving
// it. The chips show where you are. They are not buttons: the steps are taken in order.
//
// window.TowerDesk.stepper(options) -> { go, next, back, say, busy, render, guard, enter, step }
//   options.root       the element that holds the <section data-step="..."> blocks
//   options.flow       function () -> the step ids in order (asked again every time, so it may change while the page is used)
//   options.title      function (step) -> the chip text; '' means the step has no chip and no "Step N of M" in front of its help
//   options.intro      function (step) -> the help shown under the chips (html)
//   options.nextLabel  function (step) -> the text of the Next button (nothing means "Next")
//   options.backTo     optional function (step) -> the step Back goes to; '' hides Back; nothing means the step before
//
//   go(step)           show a step (it must be in flow())
//   next(), back()     what the Next and Back buttons do
//   guard(step, fn)    fn(done) runs when Next is pressed on that step. done(true) moves to the next step,
//                      done(true, 'stepId') jumps to that step, done(false, 'why') stays and shows why.
//   enter(step, fn)    fn() runs every time that step is shown
//   say(text, bad)     the short message next to the buttons (bad = shown as an error)
//   busy(on)           disables Next while something is being checked; busy() tells whether it is
//   render()           draw the chips, the help and the buttons again (after the page changed what flow() returns)
//   step()             the id of the step that is shown
(function () {
    'use strict';
    window.TowerDesk = window.TowerDesk || {};

    window.TowerDesk.stepper = function (o) {
        var esc = window.TowerDesk.fmt.esc;
        var root = o.root;
        var W = { step: o.flow()[0], busy: false, guards: {}, enter: {} };

        // The chips, the help line and the buttons are made here, so pages do not carry that markup. They get ids
        // from the root's id (for example su-steps, su-intro, su-nav, su-msg) so page styles can still reach them.
        function make(tag, cls, part) {
            var el = document.createElement(tag);
            el.className = cls;
            if (root.id) el.id = root.id + '-' + part;
            return el;
        }
        var chips = make('ol', 'wz-steps', 'steps');
        chips.setAttribute('aria-label', 'Steps');
        var intro = make('p', 'wz-intro', 'intro');
        intro.setAttribute('aria-live', 'polite');
        intro.setAttribute('tabindex', '-1');
        var nav = make('div', 'wz-nav', 'nav');
        nav.innerHTML = '<button type="button" class="btn-secondary" data-wz="back">Back</button><button type="button" class="btn-primary" data-wz="next">Next</button><span class="muted" role="status"></span>';
        var backBtn = nav.querySelector('[data-wz=back]'), nextBtn = nav.querySelector('[data-wz=next]'), msg = nav.querySelector('[role=status]');
        if (root.id) msg.id = root.id + '-msg';
        root.insertBefore(intro, root.firstChild);
        root.insertBefore(chips, intro);
        root.appendChild(nav);

        function say(text, bad) { msg.textContent = text || ''; msg.className = bad ? 'live-error' : 'muted'; }
        function busy(on) {
            if (on === undefined) return W.busy;
            W.busy = !!on;
            nextBtn.disabled = W.busy;
            nextBtn.setAttribute('aria-busy', W.busy ? 'true' : 'false');
        }

        // Where Back goes from the step that is shown ('' = nowhere, so Back is hidden).
        function backTarget() {
            var to = o.backTo ? o.backTo(W.step) : null;
            if (to === '') return '';
            if (to) return to;
            var f = o.flow(), i = f.indexOf(W.step);
            return i > 0 ? f[i - 1] : '';
        }
        // Next is hidden on the last step, unless that step still has something to check.
        function showNext() {
            var f = o.flow();
            nextBtn.hidden = f.indexOf(W.step) === f.length - 1 && !W.guards[W.step];
        }

        function render() {
            var f = o.flow(), at = f.indexOf(W.step);
            Array.prototype.forEach.call(root.querySelectorAll('[data-step]'), function (s) { s.classList.toggle('wz-off', s.dataset.step !== W.step); });
            var shown = f.filter(function (s) { return !!o.title(s); });
            chips.innerHTML = shown.map(function (s, n) {
                var i = f.indexOf(s);
                return '<li class="' + (i === at ? 'on' : i < at ? 'done' : '') + '"' + (i === at ? ' aria-current="step"' : '') + '><span class="wz-chip"><span class="wz-n">' + (n + 1) + '</span>' + esc(o.title(s)) + '</span></li>';
            }).join('');
            var n = shown.indexOf(W.step);
            intro.innerHTML = (n < 0 ? '' : '<strong>Step ' + (n + 1) + (shown.length > 1 ? ' of ' + shown.length : '') + '.</strong> ') + o.intro(W.step);
            backBtn.hidden = !backTarget();
            showNext();
            nextBtn.textContent = (o.nextLabel && o.nextLabel(W.step)) || 'Next';
            nextBtn.disabled = W.busy;
            say('');
        }

        function go(step) {
            if (o.flow().indexOf(step) < 0) return;
            W.step = step;
            render();
            if (W.enter[step]) W.enter[step]();
            // Put the cursor in the first field of the step. A step with nothing to type gets its help line read out.
            var sel = '[data-step="' + step + '"] ', first = null;
            Array.prototype.some.call(root.querySelectorAll(sel + 'input:not(:disabled), ' + sel + 'select:not(:disabled)'), function (el) {
                if (el.offsetParent) first = el;
                return !!first;
            });
            if (first) first.focus();
            else { chips.scrollIntoView({ block: 'nearest' }); intro.focus({ preventScroll: true }); }
        }
        // The step after the one shown. flow() is asked now, because checking a step may have changed it.
        function advance() {
            var f = o.flow(), i = f.indexOf(W.step);
            if (i >= 0 && i < f.length - 1) go(f[i + 1]);
        }
        function next() {
            if (W.busy) return;
            var from = W.step, guard = W.guards[from];
            if (!guard) { advance(); return; }
            busy(true);
            guard(function (ok, arg) {
                busy(false);
                if (W.step !== from) return; // the page moved to another step by itself while this one was being checked
                if (!ok) { say(arg || 'Check this step.', true); return; }
                if (arg) go(arg); else advance();
            });
        }
        function back() {
            if (W.busy) return;
            var to = backTarget();
            if (to) go(to);
        }

        nav.addEventListener('click', function (e) { var b = e.target.closest('[data-wz]'); if (b) (b.dataset.wz === 'next' ? next : back)(); });
        // Enter means Next, so a step is never skipped by accident.
        root.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || /^(BUTTON|TEXTAREA|SUMMARY|A)$/.test(e.target.tagName)) return;
            e.preventDefault(); next();
        });

        render();
        return {
            go: go, next: next, back: back, say: say, busy: busy, render: render,
            guard: function (step, fn) { W.guards[step] = fn; showNext(); },
            enter: function (step, fn) { W.enter[step] = fn; },
            step: function () { return W.step; }
        };
    };
})();
