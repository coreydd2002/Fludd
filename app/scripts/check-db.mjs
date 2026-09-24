/**
 * Verifies that supabase/migrations/0001_init.sql has actually been applied to
 * the project in .env.local.
 *
 * The setup-check page at / only proves the keys are present; it says nothing
 * about whether the schema exists. This connects and looks.
 *
 *   npm run check:db
 *
 * Uses the service role key, so it sees the schema regardless of RLS. Nothing
 * is written and no key is printed.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run this with: npm run check:db",
  );
  process.exit(1);
}

const TABLES = [
  "companies",
  "techs",
  "default_checklist_items",
  "customers",
  "customer_checklist_items",
  "visits",
  "visit_items",
  "visit_photos",
  "feedback",
];

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => console.log(`  ✗ ${m}`);

let problems = 0;

console.log(`\nChecking ${new URL(url).host}\n`);

console.log("Tables");
for (const table of TABLES) {
  // A real GET, not head:true. A HEAD response carries no body, so PostgREST's
  // error JSON never arrives and a missing table reports as success.
  const { error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    fail(`${table} — ${error.message}`);
    problems += 1;
  } else {
    pass(table);
  }
}

console.log("\nFunctions");
for (const fn of ["current_company_id", "generate_public_token"]) {
  const { error } = await supabase.rpc(fn);
  // current_company_id() returns null when there is no signed-in user, which is
  // exactly the case here. Only a missing function is a failure.
  if (error) {
    fail(`${fn}() — ${error.message}`);
    problems += 1;
  } else {
    pass(`${fn}()`);
  }
}

console.log("\nStorage");
{
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    fail(`could not list buckets — ${error.message}`);
    problems += 1;
  } else {
    const bucket = data.find((b) => b.id === "visit-photos");
    if (!bucket) {
      fail("visit-photos bucket is missing");
      problems += 1;
    } else if (bucket.public) {
      fail("visit-photos bucket is PUBLIC — it must be private");
      problems += 1;
    } else {
      pass("visit-photos bucket exists and is private");
    }
  }
}

if (problems === 0) {
  console.log("\nSchema is in place. Ready for Phase 1.\n");
} else {
  console.log(
    `\n${problems} problem(s). Open the Supabase SQL Editor and run\n` +
      "supabase/migrations/0001_init.sql, then try again.\n",
  );
  process.exit(1);
}
