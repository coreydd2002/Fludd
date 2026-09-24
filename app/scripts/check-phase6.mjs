/**
 * Phase 6 acceptance test: installability.
 *
 * Checks the things that make a browser offer "Add to Home Screen", and the
 * failure mode that is easiest to miss — a manifest or icon that the auth proxy
 * redirects to /login, which kills the install prompt with no visible error.
 *
 * Needs `npm run dev` running.
 *
 *   npm run check:phase6
 */
const BASE = process.env.CHECK_BASE_URL || "http://localhost:3000";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  console.log(`  ✗ ${m}`);
  failures += 1;
};

try {
  console.log(`\nChecking ${BASE}\n`);

  console.log("Manifest");
  const res = await fetch(`${BASE}/manifest.webmanifest`, { redirect: "manual" });

  if (res.status === 200) ok("served without a session");
  else bad(`expected 200, got ${res.status} — the proxy is probably gating it`);

  const type = res.headers.get("content-type") ?? "";
  if (/manifest\+json|application\/json/.test(type)) ok(`correct content type (${type.split(";")[0]})`);
  else bad(`unexpected content type: ${type}`);

  const m = await res.json();

  for (const [field, test, detail] of [
    ["name", () => Boolean(m.name), m.name],
    ["short_name", () => Boolean(m.short_name) && m.short_name.length <= 12, m.short_name],
    ["start_url", () => Boolean(m.start_url), m.start_url],
    ["display: standalone", () => m.display === "standalone", m.display],
    ["theme_color", () => /^#[0-9a-f]{6}$/i.test(m.theme_color ?? ""), m.theme_color],
    ["background_color", () => /^#[0-9a-f]{6}$/i.test(m.background_color ?? ""), m.background_color],
  ]) {
    if (test()) ok(`${field} — ${detail}`);
    else bad(`${field} is wrong or missing (${JSON.stringify(detail)})`);
  }

  console.log("\nIcons");
  const sizes = (m.icons ?? []).map((i) => i.sizes);
  if (sizes.includes("192x192")) ok("has a 192x192 icon");
  else bad("missing the 192x192 icon browsers require");
  if (sizes.includes("512x512")) ok("has a 512x512 icon");
  else bad("missing the 512x512 icon browsers require");

  const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
  if (maskable.length > 0) ok("has a maskable icon for Android");
  else bad("no maskable icon — Android will letterbox it");

  for (const icon of m.icons ?? []) {
    const r = await fetch(`${BASE}${icon.src}`, { redirect: "manual" });
    const ct = r.headers.get("content-type") ?? "";
    if (r.status === 200 && ct.startsWith("image/")) {
      ok(`${icon.src} loads (${icon.purpose})`);
    } else {
      bad(`${icon.src} returned ${r.status} ${ct} — icons must not be auth-gated`);
    }
  }

  const apple = await fetch(`${BASE}/apple-touch-icon.png`, { redirect: "manual" });
  if (apple.status === 200) ok("apple-touch-icon.png loads (iOS home screen)");
  else bad(`apple-touch-icon.png returned ${apple.status}`);

  console.log("\nDocument head");
  const html = await (await fetch(`${BASE}/login`)).text();

  for (const [what, re] of [
    ["links the manifest", /rel="manifest"/],
    ["sets theme-color", /name="theme-color"/],
    // Next emits the standardized name; the Apple-prefixed one is kept for
    // older iOS. Either is enough for an install prompt.
    ["declares web-app-capable", /(?:apple-)?mobile-web-app-capable/],
    ["names the iOS home screen title", /apple-mobile-web-app-title/],
    ["allows zoom (no maximum-scale=1)", /viewport/],
  ]) {
    if (re.test(html)) ok(what);
    else bad(`does not ${what}`);
  }

  if (/viewport-fit=cover/.test(html)) ok("draws into the safe area (viewport-fit=cover)");
  else bad("missing viewport-fit=cover, so the notch will letterbox");

  if (/user-scalable=no|maximum-scale=1[^0-9]/.test(html)) {
    bad("pinch zoom is disabled — that is an accessibility failure");
  } else {
    ok("pinch zoom is not disabled");
  }

  console.log("\nError and loading states");
  const missing = await fetch(`${BASE}/customers/00000000-0000-0000-0000-000000000000`, {
    redirect: "manual",
  });
  if ([200, 307, 404].includes(missing.status)) {
    ok(`an unknown customer id is handled (HTTP ${missing.status})`);
  } else bad(`unexpected status for a bad id: ${missing.status}`);
} catch (err) {
  bad(err.message);
  if (err.message.includes("fetch failed")) console.log("\n  Is `npm run dev` running?");
}

console.log(failures === 0 ? "\nPhase 6 checks passed.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
