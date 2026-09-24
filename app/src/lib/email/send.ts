import "server-only";

import type { ReactElement } from "react";
import { Resend } from "resend";

import { devEmailOverride, emailFrom, resendApiKey } from "@/lib/env.server";

export type SendOutcome =
  | { status: "sent"; id: string | null; redirectedTo: string | null }
  /** Email is not configured at all — no API key or no from-address. */
  | { status: "skipped"; reason: string }
  /** Deliberately not sent; the customer has start emails turned off. */
  | { status: "off"; reason: string }
  | { status: "failed"; reason: string };

/**
 * The single place customer email leaves the app.
 *
 * Two rules it exists to enforce:
 *
 * 1. **It never throws.** Sending is always a side effect of something more
 *    important — a tech finishing a visit — and an email outage must not make
 *    that fail. Callers get an outcome to surface, not an exception.
 *
 * 2. **DEV_EMAIL_OVERRIDE wins.** Until a domain is verified in Resend, the
 *    shared `onboarding@resend.dev` sender can only deliver to the Resend
 *    account's own address. Without the override, mail to a real pool owner
 *    isn't just undelivered — it's silently dropped. With it set, every
 *    customer email is rerouted and the subject says where it was headed.
 */
export async function sendOwnerEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<SendOutcome> {
  let apiKey: string;
  let from: string;
  try {
    apiKey = resendApiKey();
    from = emailFrom();
  } catch (err) {
    return {
      status: "skipped",
      reason: err instanceof Error ? err.message : "Email is not configured.",
    };
  }

  const override = devEmailOverride();
  const recipient = override || to;
  // Makes it unmistakable in the inbox that this was rerouted, and to whom it
  // would have gone in production.
  const finalSubject = override ? `[dev → ${to}] ${subject}` : subject;

  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to: [recipient],
      subject: finalSubject,
      react,
    });

    if (error) {
      console.error("[email] send failed", { to: recipient, subject, error });
      return { status: "failed", reason: error.message };
    }

    return {
      status: "sent",
      id: data?.id ?? null,
      redirectedTo: override ? recipient : null,
    };
  } catch (err) {
    console.error("[email] send threw", { to: recipient, subject, err });
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "Unknown email error.",
    };
  }
}

/** Compact code for a redirect query string, so the UI can explain what happened. */
export function outcomeCode(outcome: SendOutcome): string {
  return outcome.status;
}
