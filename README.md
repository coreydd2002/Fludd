# Fludd — landing page

Marketing landing page for **Fludd**, an all-in-one pool service platform: a
consumer-grade customer app, retention analytics for owners, and optimized routing
for crews. Built for **IS 581 (Managing a Software Startup)**.

This repo is the landing page only — no product yet. Framing throughout is
pre-launch / early-access; there are no testimonials or invented customer numbers.

## Stack

Plain static HTML/CSS/JS plus one serverless function for the early-access form.
No build step, no framework, no runtime npm dependencies.

| Path | What it is |
|---|---|
| `index.html` | The whole page |
| `styles.css` | Hand-written styles (design tokens in `:root`) |
| `script.js` | Progressive enhancement: form submit, footer year |
| `favicon.svg` | Wordmark drop mark |
| `api/subscribe.js` | Vercel serverless function → emails the form via Resend |
| `vercel.json` | Clean URLs + security headers (incl. a strict CSP) |

## How the form works

Browser → `POST /api/subscribe` (same-origin Vercel function) → **Resend API**, which
sends **two** emails:

1. **Notification** to `coreydd2002@gmail.com` with the submission (`reply_to` = the
   lead), from `onboarding@resend.dev`.
2. **Confirmation** to the person who filled in the form — *"Thanks for your
   submission, {first name}! An associate will get back to you shortly."*
   (`reply_to` = `coreydd2002@gmail.com`).

Details:

- `RESEND_API_KEY` lives only as a server environment variable, never in the client.
- The function drops bots via a honeypot field and a minimum fill-time check.
- The notification uses Resend's shared `onboarding@resend.dev`. **That sender only
  delivers to the email the Resend account was created with**, so
  `coreydd2002@gmail.com` must be that account email until a domain is verified.
- **The confirmation to the lead needs a verified Resend domain** — the shared sender
  can't deliver to arbitrary addresses. Until then that send fails (logged as a
  warning) and the submission still succeeds; the lead just gets no confirmation.
  To turn it on: verify a domain in Resend, then set the `CONFIRM_FROM` env var in
  Vercel to an address on it, e.g. `Fludd <hello@yourdomain.com>`.
- Change `NOTIFY_TO` / `FROM` at the top of `api/subscribe.js` if the inbox changes.

## Run locally

Static preview (no form backend):

```sh
npx serve .
```

With the form working:

```sh
npm i -g vercel      # first time only
cp .env.example .env # then paste a real RESEND_API_KEY
vercel dev           # serves the site + /api/subscribe
```

## Deploy (Vercel)

1. Push to GitHub, then **Vercel → Add New Project → import this repo**.
   Framework preset **Other**, no build command, output directory = root.
   Vercel auto-detects `api/` as serverless functions.
2. **Project → Settings → Environment Variables**: add `RESEND_API_KEY`
   (Production + Preview) from the Resend dashboard. Optionally add `CONFIRM_FROM`
   once a sending domain is verified (see "How the form works").
3. Deploy, then submit the form on the live URL and confirm the email arrives.
4. Update `canonical`, `og:url` and `og:image` in `index.html` to the real domain.

### Netlify instead

Move the function to `netlify/functions/subscribe.js`, add a `netlify.toml`
redirect from `/api/subscribe` to `/.netlify/functions/subscribe`, and set the same
`RESEND_API_KEY` env var. Nothing else changes.

## Open items

- `og-image.png` (1200×630) and `apple-touch-icon.png` — meta tags reference them; images still to be made.
- Exact pricing number — intentionally omitted on the page.
- USPTO trademark check on "Fludd".
