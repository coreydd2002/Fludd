/**
 * Phase 5 acceptance test: the feedback loop.
 *
 * A customer leaves notes on visit 1; the tech must see them waiting, then see
 * them again at the top of visit 2, and the unread state must clear at exactly
 * the right moment. Runs as a signed-in tech, through row-level security.
 *
 *   npm run check:phase5
 */
import { createClient } from "@supabase/supabase-js";

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

const email = `fludd-p5-${Date.now()}@example.com`;
let userId = null;
let companyId = null;

/** Mirrors the query behind the nav badge. */
async function unreadCount(client) {
  const { count } = await client
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .is("read_by_tech_at", null);
  return count ?? 0;
}

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
  });
  if (cErr) throw new Error(cErr.message);
  userId = created.user.id;

  const tech = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await tech.auth.signInWithPassword({ email, password: "test-password-123" });

  const { data: cid } = await tech.rpc("bootstrap_company", {
    p_business_name: "Phase 5 Pools",
    p_display_name: "Pat",
    p_timezone: "America/Phoenix",
  });
  companyId = cid;

  const { data: customer } = await tech
    .from("customers")
    .insert({
      company_id: companyId,
      first_name: "Dana",
      email: "dana@example.com",
      address: "1 Test Way",
    })
    .select("id")
    .single();

  // --- Visit 1, finished ------------------------------------------------
  const { data: v1 } = await tech
    .from("visits")
    .insert({ customer_id: customer.id, company_id: companyId, tech_id: userId, status: "on_the_way" })
    .select("id")
    .single();
  await tech
    .from("visits")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      feedback_closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .eq("id", v1.id);

  console.log("\nThe owner leaves feedback\n");

  // Written by the service role, exactly as the public report page does.
  const { error: fErr } = await admin.from("feedback").insert({
    visit_id: v1.id,
    rating: 4,
    review: "Looked great, thanks.",
    next_visit_notes: "Gate latch sticks — please check the skimmer lid too.",
    is_urgent: false,
  });
  if (fErr) bad(`could not record feedback: ${fErr.message}`);
  else ok("feedback recorded against the finished visit");

  console.log("\nThe tech's view\n");

  if ((await unreadCount(tech)) === 1) ok("shows as 1 unread on the nav badge");
  else bad(`expected 1 unread, got ${await unreadCount(tech)}`);

  const { data: inbox } = await tech
    .from("feedback")
    .select(
      "id, rating, review, next_visit_notes, is_urgent, read_by_tech_at, visits(finished_at, customer_id, customers(first_name, last_name))",
    )
    .order("created_at", { ascending: false });

  if (inbox?.length === 1) ok("appears in the inbox");
  else bad(`inbox has ${inbox?.length ?? 0} items, expected 1`);

  const row = inbox?.[0];
  if (row?.visits?.customers?.first_name === "Dana") ok("inbox shows which customer it came from");
  else bad("inbox could not resolve the customer");
  if (row?.rating === 4 && row?.next_visit_notes?.includes("Gate latch")) {
    ok("inbox carries the rating and the next-visit notes");
  } else bad("inbox is missing the rating or notes");

  // --- The badge on the route list -------------------------------------
  const { data: waiting } = await tech
    .from("feedback")
    .select("is_urgent, next_visit_notes, visits(customer_id)")
    .is("read_by_tech_at", null);
  const flagged = (waiting ?? []).some((f) => f.visits?.customer_id === customer.id);
  if (flagged) ok("that pool is flagged on the route list");
  else bad("the pool was not flagged");

  console.log("\nStarting the next visit\n");

  const { data: v2 } = await tech
    .from("visits")
    .insert({ customer_id: customer.id, company_id: companyId, tech_id: userId, status: "on_the_way" })
    .select("id")
    .single();

  // What the visit screen shows at the top.
  const { data: carried } = await tech
    .from("feedback")
    .select("next_visit_notes, is_urgent, visits!inner(customer_id)")
    .eq("visits.customer_id", customer.id)
    .neq("visit_id", v2.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (carried?.next_visit_notes?.includes("Gate latch")) {
    ok("the notes surface at the top of the next visit");
  } else bad("the notes did not carry to the next visit");

  // What startVisit() does once the notes have been displayed.
  const { data: prior } = await tech
    .from("visits")
    .select("id")
    .eq("customer_id", customer.id)
    .neq("id", v2.id);
  await tech
    .from("feedback")
    .update({ read_by_tech_at: new Date().toISOString() })
    .in("visit_id", prior.map((v) => v.id))
    .is("read_by_tech_at", null);

  if ((await unreadCount(tech)) === 0) ok("the badge clears once the visit starts");
  else bad("the badge did not clear");

  const { data: stillThere } = await tech
    .from("feedback")
    .select("next_visit_notes, read_by_tech_at")
    .eq("visit_id", v1.id)
    .single();
  if (stillThere.read_by_tech_at && stillThere.next_visit_notes?.includes("Gate latch")) {
    ok("the feedback stays in the inbox, just marked read");
  } else bad("marking read destroyed the feedback");

  console.log("\nUrgent feedback\n");

  await tech.from("visits").update({ status: "cancelled" }).eq("id", v2.id);
  const { data: v3 } = await tech
    .from("visits")
    .insert({ customer_id: customer.id, company_id: companyId, tech_id: userId, status: "on_the_way" })
    .select("id")
    .single();
  await tech
    .from("visits")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      feedback_closes_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .eq("id", v3.id);

  await admin.from("feedback").insert({
    visit_id: v3.id,
    rating: 1,
    review: "Water has gone green and the pump is grinding.",
    is_urgent: true,
  });

  const { data: urgentWaiting } = await tech
    .from("feedback")
    .select("is_urgent, visits(customer_id)")
    .is("read_by_tech_at", null);
  const isUrgentFlagged = (urgentWaiting ?? []).some(
    (f) => f.is_urgent && f.visits?.customer_id === customer.id,
  );
  if (isUrgentFlagged) ok("an urgent report flags the pool as urgent, not just new");
  else bad("urgent feedback was not flagged as urgent");

  console.log("\nIsolation\n");

  const otherEmail = `fludd-p5-other-${Date.now()}@example.com`;
  const { data: other } = await admin.auth.admin.createUser({
    email: otherEmail,
    password: "test-password-123",
    email_confirm: true,
  });
  const otherTech = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await otherTech.auth.signInWithPassword({ email: otherEmail, password: "test-password-123" });
  const { data: otherCid } = await otherTech.rpc("bootstrap_company", {
    p_business_name: "Someone Else Pools",
    p_display_name: "Sam",
    p_timezone: "UTC",
  });

  const { data: seen } = await otherTech.from("feedback").select("id");
  if ((seen ?? []).length === 0) ok("another company sees none of this feedback");
  else bad(`another company saw ${seen.length} feedback rows`);

  await admin.from("companies").delete().eq("id", otherCid);
  await admin.auth.admin.deleteUser(other.user.id);
} catch (err) {
  bad(`threw: ${err.message}`);
} finally {
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("\nCleaned up.");
}

console.log(failures === 0 ? "\nPhase 5 checks passed.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
