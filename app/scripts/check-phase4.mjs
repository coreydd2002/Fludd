/**
 * Phase 4 acceptance test: the public report page.
 *
 * Builds a real completed visit with deliberately identifiable private data,
 * then fetches /r/<token> as a logged-out stranger and asserts what the page
 * does and does not contain. Needs `npm run dev` running.
 *
 *   npm run check:phase4
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.CHECK_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  console.log(`  ✗ ${m}`);
  failures += 1;
};

// Strings that must never reach the page. Made distinctive so a match is proof.
const SECRET = {
  lastName: "Zzyzxvington",
  address: "9981 Confidential Gate Road",
  email: "do-not-leak-9981@example.com",
  internalNotes: "GATE CODE 7744 — dog is aggressive",
};

const stamp = Date.now();
const techEmail = `fludd-p4-${stamp}@example.com`;
let userId = null;
let companyId = null;

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: techEmail,
    password: "test-password-123",
    email_confirm: true,
  });
  if (cErr) throw new Error(cErr.message);
  userId = created.user.id;

  const tech = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await tech.auth.signInWithPassword({ email: techEmail, password: "test-password-123" });

  const { data: cid } = await tech.rpc("bootstrap_company", {
    p_business_name: "Phase 4 Pools",
    p_display_name: "Pat",
    p_timezone: "America/Phoenix",
  });
  companyId = cid;

  const { data: customer } = await tech
    .from("customers")
    .insert({
      company_id: companyId,
      first_name: "Dana",
      last_name: SECRET.lastName,
      email: SECRET.email,
      address: SECRET.address,
      internal_notes: SECRET.internalNotes,
    })
    .select("id")
    .single();

  const { data: visit } = await tech
    .from("visits")
    .insert({ customer_id: customer.id, company_id: companyId, tech_id: userId, status: "on_the_way" })
    .select("id, public_token")
    .single();

  await tech.from("visit_items").insert([
    { visit_id: visit.id, label: "Skim surface", position: 0, completed: true },
    { visit_id: visit.id, label: "Vacuum", position: 1, completed: true },
    { visit_id: visit.id, label: "Brush walls", position: 2, completed: false },
  ]);

  await tech
    .from("visits")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      feedback_closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      chlorine_ppm: 3.0,
      ph: 7.4,
      alkalinity_ppm: 90,
      tech_notes: "Water level was low; topped it up.",
    })
    .eq("id", visit.id);

  const token = visit.public_token;

  console.log("\nThe report, fetched with no session\n");
  const res = await fetch(`${BASE}/r/${token}`);
  const html = await res.text();

  if (res.status === 200) ok("opens without logging in");
  else bad(`expected HTTP 200, got ${res.status}`);

  for (const [what, needle] of [
    ["owner's first name", "Dana"],
    ["tech's name", "Pat"],
    ["business name", "Phase 4 Pools"],
    ["chlorine reading", "3.0"],
    ["pH reading", "7.4"],
    ["alkalinity reading", "90"],
    ["healthy-range banner", "All readings in the healthy range"],
    ["completed service", "Skim surface"],
    ["unfinished service", "not done today"],
    ["tech's note", "Water level was low"],
    ["feedback form", "How did it go?"],
  ]) {
    if (html.includes(needle)) ok(`shows the ${what}`);
    else bad(`missing the ${what} (${JSON.stringify(needle)})`);
  }

  console.log("\nPrivacy — none of this may appear\n");
  for (const [what, needle] of [
    ["last name", SECRET.lastName],
    ["street address", SECRET.address],
    ["email address", SECRET.email],
    ["private gate-code note", SECRET.internalNotes],
    ["gate code alone", "7744"],
  ]) {
    if (html.includes(needle)) bad(`LEAKED the ${what}`);
    else ok(`no ${what}`);
  }

  if (/noindex/i.test(html)) ok("marked noindex so it cannot be crawled");
  else bad("missing noindex");

  console.log("\nBad and unfinished tokens\n");
  const invalid = await fetch(`${BASE}/r/thistokendoesnotexistatall12345`);
  const invalidHtml = await invalid.text();
  if (invalidHtml.includes("isn&#x27;t valid") || invalidHtml.includes("isn't valid")) {
    ok("an unknown token gets the generic invalid page");
  } else bad("unknown token did not render the invalid page");

  const { data: open } = await tech
    .from("visits")
    .insert({ customer_id: customer.id, company_id: companyId, tech_id: userId, status: "on_the_way" })
    .select("public_token")
    .single();
  const pending = await fetch(`${BASE}/r/${open.public_token}`);
  const pendingHtml = await pending.text();
  if (/isn&#x27;t finished|isn't finished/.test(pendingHtml)) {
    ok("an in-progress visit says the service isn't finished");
  } else bad("in-progress visit did not render the pending page");

  console.log("\nFeedback rules\n");
  const { error: insErr } = await admin.from("feedback").insert({
    visit_id: visit.id,
    rating: 5,
    review: "Great job",
    is_urgent: false,
  });
  if (!insErr) ok("feedback can be recorded for an open visit");
  else bad(`first feedback insert failed: ${insErr.message}`);

  const { error: dupErr } = await admin.from("feedback").insert({
    visit_id: visit.id,
    rating: 1,
    review: "second attempt",
  });
  if (dupErr?.code === "23505") ok("a second submission is rejected by the database");
  else bad("a duplicate submission was accepted");

  const after = await fetch(`${BASE}/r/${token}`);
  const afterHtml = await after.text();
  if (afterHtml.includes("already sent feedback")) {
    ok("the page then shows feedback was already sent");
  } else bad("page still offers the form after submission");
  if (afterHtml.includes("Skim surface")) ok("the report itself still renders");
  else bad("the report stopped rendering after feedback");

  // Starting a new visit closes the old window; the report must survive.
  await admin.from("visits").update({ feedback_closes_at: new Date().toISOString() }).eq("id", visit.id);
  await admin.from("feedback").delete().eq("visit_id", visit.id);
  const closed = await fetch(`${BASE}/r/${token}`);
  const closedHtml = await closed.text();
  if (closedHtml.includes("has closed")) ok("a closed window hides the form");
  else bad("closed window still shows the form");
  if (closedHtml.includes("Skim surface")) ok("the report still renders after closing");
  else bad("report stopped rendering once feedback closed");

  console.log("\nPhotos\n");
  if (!html.includes("/storage/v1/object/public/")) {
    ok("no public storage URLs in the page");
  } else bad("page contains a PUBLIC storage URL");
} catch (err) {
  bad(`threw: ${err.message}`);
} finally {
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("\nCleaned up.");
}

console.log(failures === 0 ? "\nPhase 4 checks passed.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
