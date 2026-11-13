import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type { Company, Tech } from "./supabase/database.types";

/**
 * The signed-in tech and their company, or a redirect.
 *
 * Every authed page and Server Action calls this. Server Actions are reachable
 * by direct POST, not only through the UI, so the check has to live in the
 * action itself — not merely in the page that renders the form.
 *
 * getUser() is deliberate: it revalidates the JWT with Supabase. getSession()
 * only decodes the cookie, which the browser can tamper with.
 */
export async function requireTech(): Promise<{ tech: Tech; company: Company }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tech } = await supabase.from("techs").select("*").eq("id", user.id).maybeSingle();
  if (!tech) redirect("/onboarding");

  // A deactivated person keeps their row — visits.tech_id is `on delete
  // restrict`, so a finished report must go on saying who serviced the pool —
  // but they must not get in. Not /onboarding: that would invite them to
  // create a company of their own, which is not what being removed means.
  if (!tech.active) redirect("/login?status=deactivated");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", tech.company_id)
    .maybeSingle();
  if (!company) redirect("/onboarding");

  return { tech, company };
}

/**
 * The signed-in tech, who must be an owner.
 *
 * For the screens and actions that manage people and company settings. The
 * database enforces this too — `set_tech_role` and `set_tech_active` re-check
 * it, and the `invites` policy requires it — because a Server Action is
 * reachable by direct POST, not only through a page that hid the button.
 * This check is what makes the UI agree with the database, not what secures it.
 */
export async function requireOwner(): Promise<{ tech: Tech; company: Company }> {
  const context = await requireTech();
  if (context.tech.role !== "owner") redirect("/");
  return context;
}

/** The auth user, or null. For pages that must render either way. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
