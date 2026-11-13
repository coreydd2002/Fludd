"use server";

import { revalidatePath } from "next/cache";

import { InviteEmail, inviteEmailSubject } from "@/emails/InviteEmail";
import { requireOwner } from "@/lib/auth";
import { sendOwnerEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type TeamState = { error?: string; notice?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invites somebody to this company.
 *
 * The row is written before the email is attempted, and a failed send does not
 * roll it back — the invite exists either way and the link can be copied from
 * the roster. Losing an invitation because a mail provider was briefly down
 * would be the worse outcome. Same contract `sendOwnerEmail` keeps everywhere.
 */
export async function inviteTeammate(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const { tech, company } = await requireOwner();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "tech");

  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (role !== "owner" && role !== "tech") return { error: "Pick a role." };

  const supabase = await createClient();

  // A second invite to the same address replaces the first, so a resend is not
  // a pile of live tokens. The partial unique index is what decides.
  await supabase
    .from("invites")
    .delete()
    .eq("company_id", company.id)
    .eq("email", email)
    .is("accepted_at", null);

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({ company_id: company.id, email, role, invited_by: tech.id })
    .select("token")
    .single();

  if (error) return { error: error.message };

  const outcome = await sendOwnerEmail({
    to: email,
    subject: inviteEmailSubject(company.business_name),
    react: InviteEmail({
      businessName: company.business_name,
      invitedBy: tech.display_name,
      url: `${appUrl}/invite/${invite.token}`,
    }),
  });

  revalidatePath("/settings/team");

  if (outcome.status === "sent") return { notice: `Invitation sent to ${email}.` };
  if (outcome.status === "skipped") {
    return {
      notice: `Invite created for ${email}, but email is not configured — copy the link below.`,
    };
  }
  return {
    notice: `Invite created for ${email}, but the email could not be sent — copy the link below.`,
  };
}

/** Withdraws an invitation that has not been accepted. */
export async function revokeInvite(formData: FormData): Promise<void> {
  const { company } = await requireOwner();
  const id = String(formData.get("invite_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("invites").delete().eq("id", id).eq("company_id", company.id);
  revalidatePath("/settings/team");
}

/**
 * Promotes or demotes somebody.
 *
 * Through the database function rather than an update: `techs: update self`
 * deliberately stops an owner editing anyone else's row, and the function is
 * where "a company must keep an owner" is enforced.
 */
export async function changeRole(formData: FormData): Promise<void> {
  await requireOwner();
  const techId = String(formData.get("tech_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!techId || (role !== "owner" && role !== "tech")) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tech_role", { p_tech: techId, p_role: role });
  if (error) console.error("[team] set_tech_role", error.message);

  revalidatePath("/settings/team");
}

/** Turns somebody's access off, or back on. */
export async function changeActive(formData: FormData): Promise<void> {
  await requireOwner();
  const techId = String(formData.get("tech_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!techId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tech_active", { p_tech: techId, p_active: active });
  if (error) console.error("[team] set_tech_active", error.message);

  revalidatePath("/settings/team");
  revalidatePath("/customers");
}
