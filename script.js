/* Fludd landing page — progressive enhancement only. No dependencies. */
(function () {
  'use strict';

  var CONTACT_EMAIL = 'coreydd2002@gmail.com';

  // Footer year.
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Early-access form ------------------------------------------------
  var form = document.getElementById('signup');
  if (!form) return;

  var el = form.elements;
  var tField = document.getElementById('form-t');
  if (tField) tField.value = String(Date.now());

  var btn = document.getElementById('submit-btn');
  var statusEl = document.getElementById('form-status');
  var successEl = document.getElementById('form-success');
  var successEmailEl = document.getElementById('success-email');
  var btnLabel = btn ? btn.textContent : '';

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot: behave like a success, send nothing.
    var honey = el['_honey'];
    if (honey && honey.value.trim() !== '') {
      showSuccess(el['email'] ? el['email'].value : '');
      return;
    }

    if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
      if (typeof form.reportValidity === 'function') form.reportValidity();
      return;
    }

    var payload = {
      name: el['name'].value,
      email: el['email'].value,
      company: el['company'].value,
      poolCount: el['poolCount'] ? el['poolCount'].value : '',
      message: el['message'] ? el['message'].value : '',
      _honey: honey ? honey.value : '',
      _t: tField ? tField.value : ''
    };

    setBusy(true);
    setStatus('');

    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return {}; })
          .then(function (body) {
            return { ok: res.ok && body && body.ok === true, error: body && body.error };
          });
      })
      .then(function (result) {
        if (result.ok) {
          showSuccess(payload.email);
        } else {
          fail(result.error);
        }
      })
      .catch(function () { fail(); });
  });

  function setBusy(busy) {
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? 'Sending…' : btnLabel;
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function fail(msg) {
    setBusy(false);
    setStatus(
      (msg || 'Something went wrong sending that.') +
      ' You can email ' + CONTACT_EMAIL + ' directly.',
      true
    );
  }

  function showSuccess(email) {
    if (successEl) {
      if (successEmailEl) successEmailEl.textContent = email || 'you';
      form.hidden = true;
      successEl.hidden = false;
      if (typeof successEl.focus === 'function') successEl.focus();
    } else {
      setBusy(false);
      setStatus('Thanks — you’re on the list.');
    }
  }
})();
