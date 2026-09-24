/**
 * Can a logged-out request read customer data?
 *
 * Connects with the ANON key — the same key shipped to every browser — and
 * tries to read tables that must never be readable without a session. An
 * error is the pass condition here.
 */
import { createClient } from "@supabase/supabase-js";

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);

let exposed = 0;
console.log("\nAs anon (logged out):\n");

for (const table of ["customers", "companies", "techs", "visits", "feedback"]) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  if (error) {
    console.log(`  \u2713 ${table} refused — ${error.code ?? ""} ${error.message}`.trimEnd());
  } else {
    console.log(`  \u2717 ${table} READABLE by anon (${data.length} row(s) returned)`);
    exposed += 1;
  }
}

console.log(
  exposed === 0
    ? "\nRow-level security is holding.\n"
    : `\n${exposed} table(s) exposed to logged-out requests — RLS is NOT in place.\n`,
);
