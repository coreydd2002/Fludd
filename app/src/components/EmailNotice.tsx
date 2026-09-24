/**
 * Reports what happened to a customer email, without ever having blocked the
 * action that triggered it. A tech who finished a visit needs to know the
 * report didn't go out — but finding out must not have stopped them finishing.
 *
 * The states are kept distinct on purpose. "Not configured", "turned off for
 * this pool" and "Resend refused it" have completely different fixes, and a
 * single message covering all three sends you looking in the wrong place.
 */

/**
 * Turns Resend's wording into the specific thing to change.
 *
 * Every one of these is a setup mistake with a known fix, and reading the raw
 * API error leaves you guessing which. Matching is loose because Resend has
 * reworded these messages before.
 */
function explain(reason: string): string | null {
  const r = reason.toLowerCase();

  if (r.includes("testing emails") || r.includes("own email address")) {
    return (
      "Resend's shared onboarding@resend.dev sender can only deliver to the " +
      "address that owns the Resend account. Set DEV_EMAIL_OVERRIDE to that " +
      "exact address — the one you signed up to Resend with — and redeploy."
    );
  }
  if (r.includes("not verified") || r.includes("domain")) {
    return (
      "The from-address uses a domain Resend hasn't verified. Until you verify " +
      "one, EMAIL_FROM must be exactly: Fludd <onboarding@resend.dev>"
    );
  }
  if (r.includes("api key") || r.includes("unauthorized") || r.includes("401")) {
    return (
      "Resend rejected the API key. Check RESEND_API_KEY on this Vercel " +
      "project — note it is separate from the landing page project's key — " +
      "and redeploy after changing it."
    );
  }
  if (r.includes("invalid") && r.includes("from")) {
    return (
      "The from-address is malformed. EMAIL_FROM needs the angle brackets: " +
      "Fludd <onboarding@resend.dev>"
    );
  }
  if (r.includes("rate") || r.includes("too many") || r.includes("429")) {
    return "Resend is rate limiting. Wait a minute and try again.";
  }
  return null;
}

export function EmailNotice({
  status,
  reason,
  redirectedTo,
  sentLabel,
}: {
  status?: string;
  /** Resend's own complaint, when there is one. */
  reason?: string;
  /** Set when DEV_EMAIL_OVERRIDE rerouted it away from the real customer. */
  redirectedTo?: string;
  sentLabel: string;
}) {
  if (!status) return null;

  if (status === "sent") {
    return (
      <p
        role="status"
        className="mt-4 rounded-sm bg-ok-tint px-3 py-2 text-sm font-medium text-ok-deep"
      >
        {sentLabel}
        {redirectedTo
          ? ` Development mode sent it to ${redirectedTo} instead of the customer.`
          : ""}
      </p>
    );
  }

  if (status === "off") {
    return (
      <p
        role="status"
        className="mt-4 rounded-sm bg-brand-tint-2 px-3 py-2 text-sm text-ink-soft"
      >
        No email sent — &ldquo;on my way&rdquo; is turned off for this pool. You
        can change that on the customer&apos;s page.
      </p>
    );
  }

  if (status === "skipped") {
    return (
      <div
        role="alert"
        className="mt-4 rounded-sm bg-warn-tint px-3 py-3 text-sm text-warn"
      >
        <p className="font-bold">No email sent — email isn&apos;t set up yet.</p>
        <p className="mt-1">
          Add <code className="font-mono">RESEND_API_KEY</code> and{" "}
          <code className="font-mono">EMAIL_FROM</code> to this deployment&apos;s
          environment variables, then redeploy.
        </p>
      </div>
    );
  }

  const guidance = reason ? explain(reason) : null;

  return (
    <div
      role="alert"
      className="mt-4 rounded-sm bg-warn-tint px-3 py-3 text-sm text-warn"
    >
      <p className="font-bold">Resend refused this email.</p>

      {guidance ? <p className="mt-1.5 font-medium">{guidance}</p> : null}

      {reason ? (
        <p className="mt-2 rounded-sm bg-warn/10 px-2 py-1.5 font-mono text-[12px] break-words">
          {reason}
        </p>
      ) : null}

      <p className="mt-2 text-ink-soft">
        The visit saved normally — only the email failed.
      </p>
    </div>
  );
}
