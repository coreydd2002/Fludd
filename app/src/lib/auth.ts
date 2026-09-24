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

  const { data: tech } = await supabase
    .from("techs")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!tech) redirect("/onboarding");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", tech.company_id)
    .maybeSingle();
  if (!company) redirect("/onboarding");

  return { tech, company };
}

/** The auth user, or null. For pages that must render either way. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
