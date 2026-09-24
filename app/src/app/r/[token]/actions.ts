"use server";

import { revalidatePath } from "next/cache";

import {
  UrgentAlertEmail,
  urgentAlertSubject,
} from "@/emails/UrgentAlertEmail";
import { sendOwnerEmail } from "@/lib/email/send";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeedbackState = { error?: string; done?: boolean };

const MAX_REVIEW = 2000;
const MAX_NOTES = 2000;

/**
 * Records a pool owner's feedback.
 *
 * Runs with the service role because the person submitting has no account —
 * that is the whole premise of the feedback link. Everything the caller sends
 * is therefore untrusted: the token is the only authorisation, and it is
 * re-checked here rather than relying on the page having rendered a form.
 */
export async function submitFeedback(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "That link isn't valid." };

  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const review = String(formData.get("review") ?? "").trim().slice(0, MAX_REVIEW);
  const nextVisitNotes = String(formData.get("next_visit_notes") ?? "")
    .trim()
    .slice(0, MAX_NOTES);
  const isUrgent = formData.get("is_urgent") === "on";

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: "Pick a rating between 1 and 5 stars." };
  }
  if (!rating && !review && !nextVisitNotes) {
    return { error: "Add a rating or a note before sending." };
  }

  const supabase = createAdminClient();

  const { data: visit } = await supabase
    .from("visits")
    .select(
      "id, status, finished_at, feedback_closes_at, customers(first_name, last_name), techs(display_name), companies(alert_email, timezone)",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (!visit || visit.status !== "completed") {
    return { error: "That link isn't valid." };
  }

  const closesAt = visit.feedback_closes_at ? new Date(visit.feedback_closes_at) : null;
  if (!closesAt || closesAt <= new Date()) {
    return {
      error:
        "This form has closed — it stays open until your next service. Please contact your pool service directly.",
    };
  }

  const { error } = await supabase.from("feedback").insert({
    visit_id: visit.id,
    rating,
    review: review || null,
    next_visit_notes: nextVisitNotes || null,
    is_urgent: isUrgent,
  });

  if (error) {
    // The unique constraint on visit_id is what actually enforces one
    // submission per visit — a second POST loses the race rather than being
    // trusted to have seen the disabled form.
    if (error.code === "23505") {
      return { error: "Thanks — feedback for this visit was already sent." };
    }
    return { error: "Something went wrong sending that. Please try again." };
  }

  if (isUrgent) {
    const customerName = [visit.customers?.first_name, visit.customers?.last_name]
      .filter(Boolean)
      .join(" ");
    const servicedAt = visit.finished_at
      ? new Date(visit.finished_at).toLocaleString("en-US", {
          timeZone: visit.companies?.timezone ?? "America/Los_Angeles",
          dateStyle: "full",
          timeStyle: "short",
        })
      : "recently";

    // Best effort, and deliberately after the insert: the feedback is safely
    // recorded whether or not this email gets out.
    await sendOwnerEmail({
      to: visit.companies?.alert_email ?? "",
      subject: urgentAlertSubject(customerName || "A customer"),
      react: UrgentAlertEmail({
        techName: visit.techs?.display_name ?? "there",
        customerName: customerName || "A customer",
        servicedAt,
        message: [review, nextVisitNotes].filter(Boolean).join("\n\n") || "(no message)",
        rating,
        inboxUrl: `${appUrl}/inbox`,
      }),
    });
  }

  revalidatePath(`/r/${token}`);
  return { done: true };
}
