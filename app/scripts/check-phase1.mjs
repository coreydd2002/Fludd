/**
 * Phase 1 acceptance test, run against the real Supabase project.
 *
 * Exercises the same calls the Server Actions make, as two separate signed-in
 * accounts, and asserts that neither can see the other's data. Creates two
 * throwaway users and deletes everything it made before exiting.
 *
 *   npm run check:phase1
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const users = [
  { email: `fludd-test-a-${stamp}@example.com`, password: "test-password-123" },
  { email: `fludd-test-b-${stamp}@example.com`, password: "test-password-123" },
];

let failures = 0;
const ok = (m) => console.log(`  \u2713 ${m}`);
const bad = (m) => {
  console.log(`  \u2717 ${m}`);
  failures += 1;
};
const created = [];

async function signedInClient({ email, password }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  created.push(data.user.id);

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return client;
}

try {
  console.log("\nAccount A — signup and onboarding\n");
  const a = await signedInClient(users[0]);

  const { data: companyA, error: bootErr } = await a.rpc("bootstrap_company", {
    p_business_name: "Alice Pools",
    p_display_name: "Alice",
    p_timezone: "America/Phoenix",
  });
  if (bootErr) bad(`bootstrap_company: ${bootErr.message}`);
  else ok("bootstrap_company created the company and tech row");

  const { data: defaults } = await a
    .from("default_checklist_items")
    .select("label")
    .order("position");
  if (defaults?.length === 5) ok(`default checklist seeded (${defaults.length} items)`);
  else bad(`expected 5 default checklist items, got ${defaults?.length ?? 0}`);

  const { error: dupErr } = await a.rpc("bootstrap_company", {
    p_business_name: "Again",
    p_display_name: "Again",
    p_timezone: "UTC",
  });
  if (dupErr?.message.includes("already completed onboarding")) {
    ok("onboarding a second time is refused");
  } else bad("a second onboarding was allowed");

  console.log("\nAccount A — customers\n");
  const { data: customer, error: custErr } = await a
    .from("customers")
    .insert({
      company_id: companyA,
      first_name: "Hank",
      last_name: "Henderson",
      email: "hank@example.com",
      address: "412 Maple St",
      est_duration_minutes: 45,
      internal_notes: "Gate code 4821",
    })
    .select("id")
    .single();
  if (custErr) bad(`insert customer: ${custErr.message}`);
  else ok("customer created");

  if (customer) {
    const labels = (defaults ?? []).map((d, position) => ({
      customer_id: customer.id,
      label: d.label,
      position,
    }));
    const { error: copyErr } = await a.from("customer_checklist_items").insert(labels);
    if (copyErr) bad(`copy checklist: ${copyErr.message}`);
    else ok(`default checklist copied onto the pool (${labels.length} items)`);
  }

  console.log("\nAccount B — isolation\n");
  const b = await signedInClient(users[1]);
  await b.rpc("bootstrap_company", {
    p_business_name: "Bob Pools",
    p_display_name: "Bob",
    p_timezone: "America/New_York",
  });

  const { data: bCustomers } = await b.from("customers").select("id, first_name");
  if ((bCustomers ?? []).length === 0) ok("account B sees none of A's customers");
  else bad(`account B saw ${bCustomers.length} of A's customers`);

  const { data: bCompanies } = await b.from("companies").select("business_name");
  if (bCompanies?.length === 1 && bCompanies[0].business_name === "Bob Pools") {
    ok("account B sees only its own company");
  } else bad(`account B saw companies: ${JSON.stringify(bCompanies)}`);

  if (customer) {
    const { data: direct } = await b.from("customers").select("*").eq("id", customer.id);
    if ((direct ?? []).length === 0) ok("account B cannot fetch A's customer by id");
    else bad("account B fetched A's customer by id");

    const { error: writeErr } = await b
      .from("customers")
      .update({ first_name: "Hijacked" })
      .eq("id", customer.id);
    const { data: check } = await a.from("customers").select("first_name").eq("id", customer.id).single();
    if (check?.first_name === "Hank") ok("account B cannot overwrite A's customer");
    else bad(`account B modified A's customer (${writeErr?.message ?? "no error"})`);
  }
} catch (err) {
  bad(`threw: ${err.message}`);
} finally {
  for (const id of created) {
    const { data: tech } = await admin.from("techs").select("company_id").eq("id", id).maybeSingle();
    if (tech) await admin.from("companies").delete().eq("id", tech.company_id);
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`\nCleaned up ${created.length} test account(s).`);
}

console.log(failures === 0 ? "\nPhase 1 checks passed.\n" : `\n${failures} failure(s).\n`);
process.exit(failures === 0 ? 0 : 1);
