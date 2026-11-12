(function () {
    var form = document.getElementById('login-form');
    var err = document.getElementById('login-error');
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        err.className = 'alert-msg';
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        })
            .then(function (r) {
                return r.json().then(function (d) {
                    if (!r.ok) throw new Error(d.error || 'Sign in failed');
                });
            })
            .then(function () {
                var next = new URLSearchParams(location.search).get('next') || '/';
                // Only allow same-site relative paths as the redirect target.
                location.href = /^\/(?!\/)/.test(next) ? next : '/';
            })
            .catch(function (e2) {
                document.getElementById('password').value = '';
                err.className = 'alert-msg error';
                err.textContent = e2.message;
            });
    });
})();
