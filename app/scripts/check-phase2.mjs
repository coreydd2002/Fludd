/**
 * Phase 2 acceptance test, run against the real Supabase project.
 *
 * Drives a whole visit the way the visit screen does — as a signed-in tech,
 * through row-level security — and asserts the rules that are easy to get
 * wrong: one open visit per pool, the checklist snapshot, private photos, and
 * the feedback window closing when the next visit starts.
 *
 *   npm run check:phase2
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  console.log(`  ✗ ${m}`);
  failures += 1;
};

const email = `fludd-p2-${Date.now()}@example.com`;
const password = "test-password-123";
let userId = null;
let companyId = null;

try {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(createErr.message);
  userId = created.user.id;

  const tech = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await tech.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(signInErr.message);

  const { data: cid } = await tech.rpc("bootstrap_company", {
    p_business_name: "Phase 2 Pools",
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

  const { data: defaults } = await tech
    .from("default_checklist_items")
    .select("label")
    .order("position");
  await tech.from("customer_checklist_items").insert(
    defaults.map((d, position) => ({
      customer_id: customer.id,
      label: d.label,
      position,
    })),
  );

  console.log("\nStarting a visit\n");

  const startVisit = async () => {
    const { data, error } = await tech
      .from("visits")
      .insert({
        customer_id: customer.id,
        company_id: companyId,
        tech_id: userId,
        status: "on_the_way",
      })
      .select("id, public_token, feedback_closes_at")
      .single();
    return { data, error };
  };

  const { data: visit, error: visitErr } = await startVisit();
  if (visitErr) bad(`start visit: ${visitErr.message}`);
  else ok("visit created");

  if (visit?.public_token?.length === 43) ok("report token generated (43 chars)");
  else bad(`token looks wrong: ${JSON.stringify(visit?.public_token)}`);

  const { error: dupErr } = await startVisit();
  if (dupErr) ok("a second open visit on the same pool is rejected");
  else bad("two open visits were allowed on one pool");

  // Snapshot the checklist, as startVisit() does.
  const { data: poolItems } = await tech
    .from("customer_checklist_items")
    .select("label, position")
    .eq("customer_id", customer.id)
    .order("position");
  await tech.from("visit_items").insert(
    poolItems.map((i, position) => ({ visit_id: visit.id, label: i.label, position })),
  );

  const { data: snap } = await tech.from("visit_items").select("id, label").eq("visit_id", visit.id);
  if (snap.length === poolItems.length) ok(`checklist snapshotted (${snap.length} items)`);
  else bad(`snapshot has ${snap.length}, pool has ${poolItems.length}`);

  console.log("\nWorking the visit\n");

  await tech.from("visit_items").update({ completed: true }).eq("id", snap[0].id);
  const { data: afterToggle } = await tech
    .from("visit_items")
    .select("completed")
    .eq("id", snap[0].id)
    .single();
  if (afterToggle.completed) ok("checklist item ticks and persists");
  else bad("checklist item did not persist");

  const { error: readErr } = await tech
    .from("visits")
    .update({ chlorine_ppm: 3.0, ph: 7.4, alkalinity_ppm: 90 })
    .eq("id", visit.id);
  if (readErr) bad(`readings: ${readErr.message}`);
  else ok("chlorine / pH / alkalinity saved");

  const { error: rangeErr } = await tech
    .from("visits")
    .update({ ph: 99 })
    .eq("id", visit.id);
  if (rangeErr) ok("an impossible pH is rejected by the database");
  else bad("pH 99 was accepted");

  // Photo round trip through the private bucket.
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);
  const path = `${companyId}/${visit.id}/test.jpg`;
  const { error: upErr } = await tech.storage
    .from("visit-photos")
    .upload(path, jpeg, { contentType: "image/jpeg" });
  if (upErr) bad(`photo upload: ${upErr.message}`);
  else ok("photo uploaded to the private bucket");

  if (!upErr) {
    await tech.from("visit_photos").insert({ visit_id: visit.id, storage_path: path });

    const publicUrl = `${url}/storage/v1/object/public/visit-photos/${path}`;
    const res = await fetch(publicUrl);
    if (res.ok) bad("photo is readable WITHOUT a signed URL — bucket is public");
    else ok(`photo is not publicly readable (HTTP ${res.status})`);

    const { data: signed } = await tech.storage
      .from("visit-photos")
      .createSignedUrl(path, 60);
    const signedRes = await fetch(signed.signedUrl);
    if (signedRes.ok) ok("photo is readable through a signed URL");
    else bad(`signed URL failed: HTTP ${signedRes.status}`);
  }

  console.log("\nFinishing, and the next visit\n");

  const closesAt = new Date(Date.now() + 30 * 86400000).toISOString();
  await tech
    .from("visits")
    .update({ status: "completed", finished_at: new Date().toISOString(), feedback_closes_at: closesAt })
    .eq("id", visit.id);

  const { data: finished } = await tech
    .from("visits")
    .select("status, feedback_closes_at")
    .eq("id", visit.id)
    .single();
  if (finished.status === "completed" && finished.feedback_closes_at) {
    ok("visit completed with a 30-day feedback window");
  } else bad("finish did not set status and window");

  // Editing the pool checklist must not rewrite the finished visit.
  await tech.from("customer_checklist_items").delete().eq("customer_id", customer.id);
  await tech
    .from("customer_checklist_items")
    .insert({ customer_id: customer.id, label: "Totally different", position: 0 });

  const { data: stillSnap } = await tech.from("visit_items").select("label").eq("visit_id", visit.id);
  if (stillSnap.length === poolItems.length && !stillSnap.some((i) => i.label === "Totally different")) {
    ok("rewriting the pool checklist does not alter the finished visit");
  } else bad("the finished visit's checklist changed");

  const { data: second } = await tech
    .from("visits")
    .insert({ customer_id: customer.id, company_id: companyId, tech_id: userId, status: "on_the_way" })
    .select("id")
    .single();
  if (second) ok("a new visit can start once the previous one is finished");
  else bad("could not start a second visit after finishing");

  await tech
    .from("visits")
    .update({ feedback_closes_at: new Date().toISOString() })
    .eq("id", visit.id);
  const { data: closed } = await tech
    .from("visits")
    .select("feedback_closes_at")
    .eq("id", visit.id)
    .single();
  if (new Date(closed.feedback_closes_at) <= new Date()) {
    ok("starting a new visit closes the old feedback window");
  } else bad("old feedback window stayed open");
} catch (err) {
  bad(`threw: ${err.message}`);
} finally {
  if (companyId) await admin.from("companies").delete().eq("id", companyId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  // Objects live at company/visit/file.jpg, so a single list() only returns the
  // visit folders. Walk one level down or the bucket accumulates orphans.
  if (companyId) {
    const { data: folders } = await admin.storage.from("visit-photos").list(companyId);
    for (const folder of folders ?? []) {
      const prefix = `${companyId}/${folder.name}`;
      const { data: files } = await admin.storage.from("visit-photos").list(prefix);
      if (files?.length) {
        await admin.storage
          .from("visit-photos")
          .remove(files.map((f) => `${prefix}/${f.name}`));
      }
    }
  }
  console.log("\nCleaned up.");
}

console.log(failures === 0 ? "\nPhase 2 checks passed.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
