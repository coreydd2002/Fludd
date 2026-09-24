/**
 * Creates (or resets) a pre-confirmed development login.
 *
 *   npm run make:user
 *
 * Uses the admin API with email_confirm already true, which is the only way to
 * get a usable account while Supabase's "Confirm email" setting is on and its
 * built-in sender is rate limited.
 *
 * Development only. Delete this account before real customers exist:
 *   npm run make:user -- --delete
 */
import { createClient } from "@supabase/supabase-js";

const EMAIL = "tech@fludd.test";
const PASSWORD = "fludd-dev-password";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: list, error: listError } = await admin.auth.admin.listUsers();
if (listError) {
  console.error(`Could not list users: ${listError.message}`);
  process.exit(1);
}

const existing = list.users.find((u) => u.email === EMAIL);

/** Removes the company too, so a reset returns to a true first-run state. */
async function removeExisting(id) {
  const { data: tech } = await admin
    .from("techs")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (tech) await admin.from("companies").delete().eq("id", tech.company_id);
  await admin.auth.admin.deleteUser(id);
}

if (process.argv.includes("--delete")) {
  if (existing) {
    await removeExisting(existing.id);
    console.log(`\nDeleted ${EMAIL} and its company.\n`);
  } else {
    console.log(`\nNothing to delete — ${EMAIL} does not exist.\n`);
  }
  process.exit(0);
}

if (existing) {
  await removeExisting(existing.id);
  console.log(`\nReset the existing ${EMAIL} back to a fresh account.`);
}

const { error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});

if (error) {
  console.error(`\nCould not create the user: ${error.message}\n`);
  process.exit(1);
}

console.log(`
Development login ready — no email confirmation needed.

  email     ${EMAIL}
  password  ${PASSWORD}

Sign in at http://localhost:3000/login and you'll land on onboarding.
Run "npm run make:user" again to wipe it and start over.
`);
