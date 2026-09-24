/**
 * Reports what happened to a customer email, without ever having blocked the
 * action that triggered it. A tech who finished a visit needs to know the
 * report didn't go out — but finding out must not have stopped them finishing.
 *
 * The four states are kept distinct on purpose. "Not configured" and "turned
 * off for this pool" have completely different fixes, and a single message
 * covering both sends you looking in the wrong place.
 */
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
        className="mt-4 rounded-sm bg-warn-tint px-3 py-2 text-sm text-warn"
      >
        <p className="font-bold">No email sent — email isn&apos;t set up yet.</p>
        <p className="mt-1">
          Add <code className="font-mono">RESEND_API_KEY</code> and{" "}
          <code className="font-mono">EMAIL_FROM</code> to this deployment&apos;s
          environment variables, then redeploy.
        </p>
        {reason ? <p className="mt-1 opacity-80">{reason}</p> : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="mt-4 rounded-sm bg-warn-tint px-3 py-2 text-sm text-warn"
    >
      <p className="font-bold">The email didn&apos;t send.</p>
      <p className="mt-1">
        Everything else saved — you can tell the customer directly, and the
        report link still works.
      </p>
      {reason ? (
        <p className="mt-1 font-mono text-xs opacity-80">{reason}</p>
      ) : null}
    </div>
  );
}
