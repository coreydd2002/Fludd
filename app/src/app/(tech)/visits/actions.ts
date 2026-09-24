"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { FinishEmail, FINISH_EMAIL_SUBJECT } from "@/emails/FinishEmail";
import { StartEmail, startEmailSubject } from "@/emails/StartEmail";
import { requireTech } from "@/lib/auth";
import { sendOwnerEmail, type SendOutcome } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { allReadingsHealthy, readingsSummary } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

/**
 * Carries the send result to the next screen. The reason travels too: when a
 * send fails the operator needs Resend's actual complaint ("API key is
 * invalid", "domain is not verified"), not a shrug.
 */
function emailQuery(outcome: SendOutcome): string {
  const params = new URLSearchParams({ email: outcome.status });
  if (outcome.status !== "sent" && outcome.reason) {
    params.set("why", outcome.reason.slice(0, 200));
  }
  if (outcome.status === "sent" && outcome.redirectedTo) {
    params.set("to", outcome.redirectedTo);
  }
  return params.toString();
}

/** Days a finished report keeps accepting feedback, absent a newer visit. */
const FEEDBACK_WINDOW_DAYS = 30;

function formatInZone(iso: string, timezone: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * "On my way": opens a visit and snapshots the pool's checklist onto it.
 *
 * The snapshot is the point — editing a customer's checklist next month must
 * not rewrite what last month's report said was done.
 */
export async function startVisit(formData: FormData) {
  const { tech, company } = await requireTech();
  const customerId = String(formData.get("customer_id") ?? "");
  if (!customerId) return;

  const supabase = await createClient();

  // Already open? Just go there. This is the double-tap case.
  const { data: open } = await supabase
    .from("visits")
    .select("id")
    .eq("customer_id", customerId)
    .in("status", ["on_the_way", "in_progress"])
    .maybeSingle();
  if (open) redirect(`/visits/${open.id}`);

  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, email, est_duration_minutes, start_email_enabled")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) redirect("/");

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      customer_id: customerId,
      company_id: company.id,
      tech_id: tech.id,
      status: "on_the_way",
    })
    .select("id")
    .single();

  if (error) {
    // The one-open-visit-per-customer index can still reject this if two taps
    // raced past the check above. Recover by opening whichever visit won.
    const { data: existing } = await supabase
      .from("visits")
      .select("id")
      .eq("customer_id", customerId)
      .in("status", ["on_the_way", "in_progress"])
      .maybeSingle();
    if (existing) redirect(`/visits/${existing.id}`);
    throw new Error(error.message);
  }

  const { data: items } = await supabase
    .from("customer_checklist_items")
    .select("label, position")
    .eq("customer_id", customerId)
    .order("position");

  if (items && items.length > 0) {
    await supabase.from("visit_items").insert(
      items.map((item, position) => ({
        visit_id: visit.id,
        label: item.label,
        position,
      })),
    );
  }

  // Starting a new visit closes the previous report's feedback form. The report
  // itself stays readable — the owner keeps their history either way.
  const now = new Date().toISOString();
  await supabase
    .from("visits")
    .update({ feedback_closes_at: now })
    .eq("customer_id", customerId)
    .eq("status", "completed")
    .neq("id", visit.id)
    .or(`feedback_closes_at.is.null,feedback_closes_at.gt.${now}`);

  // The notes are about to be displayed on the visit screen, so this is the
  // honest moment to clear their unread state. Doing it during the page render
  // would be a side effect in a function React is free to re-run.
  const { data: priorVisits } = await supabase
    .from("visits")
    .select("id")
    .eq("customer_id", customerId)
    .neq("id", visit.id);

  if (priorVisits && priorVisits.length > 0) {
    await supabase
      .from("feedback")
      .update({ read_by_tech_at: new Date().toISOString() })
      .in(
        "visit_id",
        priorVisits.map((v) => v.id),
      )
      .is("read_by_tech_at", null);
  }

  let outcome: SendOutcome = { status: "off", reason: "turned off for this pool" };
  if (customer.start_email_enabled) {
    outcome = await sendOwnerEmail({
      to: customer.email,
      subject: startEmailSubject(tech.display_name),
      react: StartEmail({
        ownerFirstName: customer.first_name,
        techName: tech.display_name,
        businessName: company.business_name,
        estMinutes: customer.est_duration_minutes,
        services: (items ?? []).map((i) => i.label),
      }),
    });
  }

  revalidatePath("/");
  redirect(`/visits/${visit.id}?${emailQuery(outcome)}`);
}

export async function finishVisit(formData: FormData) {
  const { tech, company } = await requireTech();
  const visitId = String(formData.get("visit_id") ?? "");
  if (!visitId) return;

  const supabase = await createClient();
  const finishedAt = new Date();
  const closesAt = new Date(finishedAt.getTime() + FEEDBACK_WINDOW_DAYS * 86_400_000);

  const { data: visit } = await supabase
    .from("visits")
    .update({
      status: "completed",
      finished_at: finishedAt.toISOString(),
      feedback_closes_at: closesAt.toISOString(),
    })
    .eq("id", visitId)
    .in("status", ["on_the_way", "in_progress"])
    .select(
      "id, public_token, tech_notes, chlorine_ppm, ph, alkalinity_ppm, customers(first_name, email)",
    )
    .maybeSingle();

  // Already finished, or someone else's visit. Either way, nothing to send.
  if (!visit) redirect(`/visits/${visitId}/done`);

  const [{ data: items }, { count: photoCount }] = await Promise.all([
    supabase
      .from("visit_items")
      .select("label, completed")
      .eq("visit_id", visitId)
      .order("position"),
    supabase
      .from("visit_photos")
      .select("*", { count: "exact", head: true })
      .eq("visit_id", visitId),
  ]);

  const readings = {
    chlorine_ppm: visit.chlorine_ppm,
    ph: visit.ph,
    alkalinity_ppm: visit.alkalinity_ppm,
  };

  const outcome = await sendOwnerEmail({
    to: visit.customers?.email ?? "",
    subject: FINISH_EMAIL_SUBJECT,
    react: FinishEmail({
      ownerFirstName: visit.customers?.first_name ?? "there",
      techName: tech.display_name,
      businessName: company.business_name,
      finishedAt: formatInZone(finishedAt.toISOString(), company.timezone),
      readingsSummary: readingsSummary(readings),
      allHealthy: allReadingsHealthy(readings),
      completed: (items ?? []).filter((i) => i.completed).map((i) => i.label),
      skipped: (items ?? []).filter((i) => !i.completed).map((i) => i.label),
      techNotes: visit.tech_notes,
      photoCount: photoCount ?? 0,
      // The report page itself arrives in Phase 4; the token and link are
      // already correct, so the email does not need revisiting then.
      reportUrl: `${appUrl}/r/${visit.public_token}`,
    }),
  });

  revalidatePath("/");
  redirect(`/visits/${visitId}/done?${emailQuery(outcome)}`);
}

export async function cancelVisit(formData: FormData) {
  await requireTech();
  const visitId = String(formData.get("visit_id") ?? "");
  if (!visitId) return;

  const supabase = await createClient();
  // Cancelled, not deleted: a cancelled visit is a real record that the tech
  // arrived and stopped, and no owner email should ever go out for it.
  await supabase
    .from("visits")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", visitId)
    .in("status", ["on_the_way", "in_progress"]);

  revalidatePath("/");
  redirect("/");
}
