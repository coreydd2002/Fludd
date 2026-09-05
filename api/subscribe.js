// Vercel serverless function: receive the early-access form and email it via Resend.
//
// The Resend API key must never reach the browser, so it lives here as the
// RESEND_API_KEY environment variable (set in the Vercel project settings).
//
// Sender note: `onboarding@resend.dev` is Resend's shared test sender. It can
// only deliver to the email address the Resend account was created with, so
// NOTIFY_TO below must be that address until a domain is verified in Resend.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'Fludd early access <onboarding@resend.dev>';
const NOTIFY_TO = 'coreydd2002@gmail.com';

const MAX = { name: 120, email: 120, company: 120, poolCount: 20, message: 2000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_FILL_MS = 2000; // submissions faster than this are almost certainly bots

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

// Send either JSON (the fetch() path) or a minimal HTML page (a no-JS form POST).
function respond(req, res, status, ok, message) {
  const wantsJson = String(req.headers.accept || '').indexOf('application/json') !== -1;
  if (wantsJson) {
    return res.status(status).json(ok ? { ok: true } : { ok: false, error: message });
  }
  const heading = ok ? 'You’re on the list' : 'That didn’t go through';
  const body = ok
    ? 'Thanks — we’ll be in touch as early-access spots open.'
    : escapeHtml(message) + ' You can email ' + NOTIFY_TO + ' directly.';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(
    '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + heading + ' — Fludd</title>' +
    '<div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:34rem;' +
    'margin:14vh auto;padding:0 1.25rem;color:#0e1b2c;line-height:1.6">' +
    '<h1 style="font-size:1.5rem">' + heading + '</h1><p>' + body + '</p>' +
    '<p><a href="/#early-access" style="color:#085aa8">← Back to Fludd</a></p></div>'
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(req, res, 405, false, 'That request method is not allowed.');
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (err) { body = {}; }
  }
  body = body || {};

  const name = str(body.name);
  const email = str(body.email);
  const company = str(body.company);
  const poolCount = str(body.poolCount);
  const message = str(body.message);
  const honey = str(body._honey);
  const startedAt = Number(body._t) || 0;

  // Bot traps: accept quietly, send nothing.
  if (honey || (startedAt && Date.now() - startedAt < MIN_FILL_MS)) {
    return respond(req, res, 200, true);
  }

  if (!name || !email || !company) {
    return respond(req, res, 400, false, 'Please add your name, email and company.');
  }
  if (!EMAIL_RE.test(email)) {
    return respond(req, res, 400, false, 'That email address looks off — mind checking it?');
  }
  if (
    name.length > MAX.name ||
    email.length > MAX.email ||
    company.length > MAX.company ||
    poolCount.length > MAX.poolCount ||
    message.length > MAX.message
  ) {
    return respond(req, res, 400, false, 'One of those fields is too long.');
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return respond(req, res, 500, false, 'The form is not configured yet.');
  }

  const submittedAt = new Date().toISOString();
  const referer = req.headers.referer || req.headers.referrer || '—';
  const userAgent = req.headers['user-agent'] || '—';

  const text = [
    'New Fludd early-access request',
    '',
    'Name:        ' + name,
    'Work email:  ' + email,
    'Company:     ' + company,
    'Pools:       ' + (poolCount || '—'),
    '',
    'Message:',
    message || '—',
    '',
    '— — —',
    'Submitted:   ' + submittedAt,
    'Referer:     ' + referer,
    'User agent:  ' + userAgent
  ].join('\n');

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.6;color:#0e1b2c">' +
    '<h2 style="margin:0 0 12px">New Fludd early-access request</h2>' +
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
    row('Name', escapeHtml(name)) +
    row('Work email', '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a>') +
    row('Company', escapeHtml(company)) +
    row('Pools serviced', escapeHtml(poolCount || '—')) +
    '</table>' +
    (message
      ? '<p style="margin:16px 0 4px;color:#4a5b6d">Message</p>' +
        '<p style="margin:0;white-space:pre-wrap">' + escapeHtml(message) + '</p>'
      : '') +
    '<hr style="border:none;border-top:1px solid #e0eaf1;margin:20px 0">' +
    '<p style="margin:0;color:#8595a3;font-size:13px">Submitted ' + escapeHtml(submittedAt) +
    '<br>Referer: ' + escapeHtml(referer) +
    '<br>UA: ' + escapeHtml(userAgent) + '</p>' +
    '</div>';

  try {
    const resendRes = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: [NOTIFY_TO],
        reply_to: email,
        subject: 'New Fludd early-access request — ' + company,
        text: text,
        html: html
      })
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(function () { return ''; });
      console.error('Resend responded', resendRes.status, detail);
      return respond(req, res, 502, false, 'Could not send that right now.');
    }

    return respond(req, res, 200, true);
  } catch (err) {
    console.error('subscribe handler failed', err);
    return respond(req, res, 502, false, 'Could not send that right now.');
  }
}

function row(label, valueHtml) {
  return (
    '<tr><td style="padding:2px 16px 2px 0;color:#4a5b6d;vertical-align:top">' +
    label +
    '</td><td><strong>' +
    valueHtml +
    '</strong></td></tr>'
  );
}
