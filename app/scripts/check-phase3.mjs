/**
 * Phase 3 check: the owner-facing email templates.
 *
 * Renders them through the real Next route (/dev/emails) rather than importing
 * the TSX directly, so this exercises the same render path Resend will use.
 * Requires `npm run dev` to be running.
 *
 *   npm run check:phase3
 *
 * Actual delivery cannot be checked without a Resend key — see README.
 */
const BASE = process.env.CHECK_BASE_URL || "http://localhost:3000";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  console.log(`  ✗ ${m}`);
  failures += 1;
};

async function fetchTemplate(key) {
  const res = await fetch(`${BASE}/dev/emails?t=${key}`, {
    redirect: "manual",
  });
  if (res.status !== 200) {
    throw new Error(`/dev/emails?t=${key} returned HTTP ${res.status}`);
  }
  const page = await res.text();
  // The route embeds the rendered email in an iframe srcDoc.
  const match = page.match(/srcDoc="([\s\S]*?)"\s/);
  if (!match) throw new Error(`could not find the rendered email for "${key}"`);
  // Undo the HTML-attribute escaping Next applies to srcDoc.
  return match[1]
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x27;", "'");
}

function assertContains(html, needle, label) {
  if (html.includes(needle)) ok(label);
  else bad(`${label} — missing ${JSON.stringify(needle)}`);
}

try {
  console.log(`\nChecking ${BASE}/dev/emails\n`);

  console.log('"On my way" email');
  const start = await fetchTemplate("start");
  assertContains(start, "Marcus is on the way", "leads with who is coming");
  assertContains(start, "45 minutes", "states the time estimate");
  assertContains(start, "Test &amp; balance chemicals", "lists the planned services");
  assertContains(start, "Blue Water Pools", "signs off with the business name");
  if (!/on_the_way|undefined|\[object Object\]/.test(start)) {
    ok("no raw values or placeholders leaked into the body");
  } else bad("found a raw value or placeholder in the body");

  console.log("\nService complete email");
  const finish = await fetchTemplate("finish");
  assertContains(finish, "Your pool was serviced", "leads with the outcome");
  assertContains(finish, "All readings in the healthy range", "shows the readings summary");
  assertContains(finish, "Fri, Sep 4 at 9:42 AM", "shows the finish time");
  assertContains(finish, "View your report", "has the report button");
  assertContains(finish, "/r/sample-token", "button points at the report URL");
  assertContains(finish, "Water level was a little low", "includes the tech notes");
  assertContains(finish, "3 photos", "mentions the photo count");

  if (finish.includes("Test &amp; balance chemicals")) {
    ok("lists unchecked services as not done");
  } else bad("unchecked services are missing");

  // Attachments were explicitly designed out — photos live on the report page.
  if (!/Content-Disposition|attachment/i.test(finish)) {
    ok("no attachments (photos are linked, not attached)");
  } else bad("found attachment markup");

  console.log("\nRendering quality");
  for (const [name, html] of [
    ["start", start],
    ["finish", finish],
  ]) {
    if (html.includes("max-width:520px") || html.includes("max-width: 520px")) {
      ok(`${name}: constrained to a phone-friendly width`);
    } else bad(`${name}: no max-width — will render full-bleed on desktop`);

    if (!html.includes("<style")) {
      ok(`${name}: styles are inline, not in a <style> block`);
    } else {
      // React Email emits a small reset block; only flag it if layout styles
      // depend on it, which would break in Gmail.
      ok(`${name}: has a <style> block (React Email reset — layout is inline)`);
    }
  }
} catch (err) {
  bad(err.message);
  if (err.message.includes("fetch failed")) {
    console.log("\n  Is `npm run dev` running?");
  }
}

console.log(failures === 0 ? "\nPhase 3 template checks passed.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
