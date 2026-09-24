"use server";

import { FinishEmail, finishEmailSample } from "@/emails/FinishEmail";
import { StartEmail, startEmailSample } from "@/emails/StartEmail";
import { sendOwnerEmail } from "@/lib/email/send";

export type TestSendState = { message?: string; tone?: "ok" | "warn" | "info" };

/**
 * Sends a sample email through the real send path.
 *
 * Doubles as the check that a misconfigured or failing Resend never throws:
 * with no key set this returns "skipped" and the page renders normally, which
 * is exactly what finishVisit() relies on.
 */
export async function sendTestEmail(
  _prev: TestSendState,
  formData: FormData,
): Promise<TestSendState> {
  if (process.env.NODE_ENV === "production") {
    return { message: "Not available in production.", tone: "warn" };
  }

  const which = String(formData.get("template") ?? "start");
  const to = String(formData.get("to") ?? "").trim();
  if (!to) {
    return { message: "Enter an address to send the test to.", tone: "warn" };
  }

  const outcome = await sendOwnerEmail({
    to,
    subject:
      which === "finish"
        ? "Your pool service is complete"
        : "Marcus is on the way to service your pool",
    react:
      which === "finish"
        ? FinishEmail(finishEmailSample)
        : StartEmail(startEmailSample),
  });

  if (outcome.status === "sent") {
    return {
      message: outcome.redirectedTo
        ? `Sent to ${outcome.redirectedTo} (DEV_EMAIL_OVERRIDE redirected it from ${to}).`
        : `Sent to ${to}.`,
      tone: "ok",
    };
  }

  if (outcome.status === "skipped") {
    return {
      message: `Nothing sent — ${outcome.reason} Add RESEND_API_KEY and EMAIL_FROM to .env.local.`,
      tone: "info",
    };
  }

  return {
    message: `Resend rejected it: ${outcome.reason}`,
    tone: "warn",
  };
}
