/**
 * Reports what happened to a customer email, without ever having blocked the
 * action that triggered it. A tech who finished a visit needs to know the
 * report didn't go out — but finding out must not have stopped them finishing.
 */
export function EmailNotice({
  status,
  sentLabel,
  redirected,
}: {
  status?: string;
  sentLabel: string;
  /** True when DEV_EMAIL_OVERRIDE rerouted it away from the real customer. */
  redirected?: boolean;
}) {
  if (!status || status === "none") return null;

  if (status === "sent") {
    return (
      <p
        role="status"
        className="mt-4 rounded-sm bg-ok-tint px-3 py-2 text-sm font-medium text-ok-deep"
      >
        {sentLabel}
        {redirected ? " (development: sent to your own inbox, not the customer)" : ""}
      </p>
    );
  }

  if (status === "skipped") {
    return (
      <p
        role="status"
        className="mt-4 rounded-sm bg-brand-tint-2 px-3 py-2 text-sm text-ink-soft"
      >
        No email sent — it&apos;s turned off for this pool, or email isn&apos;t
        configured yet.
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="mt-4 rounded-sm bg-warn-tint px-3 py-2 text-sm font-medium text-warn"
    >
      The email didn&apos;t send. Everything else saved — you can let the
      customer know directly, and the report link still works.
    </p>
  );
}
