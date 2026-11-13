"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Accepts an invitation for the signed-in account.
 *
 * All of the checking lives in `accept_invite`: that the token is live, that
 * the caller's email matches the address it was sent to, and that they do not
 * already belong to a company. Doing any of it here as well would be a second
 * copy of the rule, free to drift from the one that actually decides.
 */
export async function acceptInvite(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });

  if (error) {
    console.error("[invite] accept failed", error.message);
    redirect(`/invite/${token}?error=1`);
  }

  redirect("/");
}
