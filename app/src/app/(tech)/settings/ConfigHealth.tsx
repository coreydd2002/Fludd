import "server-only";

/**
 * Which server-side settings this deployment actually has.
 *
 * Environment variables are per Vercel project, and `NEXT_PUBLIC_*` values are
 * baked in at build time — so "I set that up already" is often true of a
 * different project, or of a build that has since been replaced. Without a way
 * to see the truth from the deployed site, diagnosing that means guessing.
 *
 * Only ever reports whether a value is present, never the value. This renders
 * inside the authenticated area, but a service role key printed into HTML would
 * be a catastrophe regardless of who is looking.
 */
type Check = {
  name: string;
  set: boolean;
  required: boolean;
  note: string;
};

function checks(): Check[] {
  const override = process.env.DEV_EMAIL_OVERRIDE;
  return [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
      note: "Database and login. Baked in at build time.",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
      note: "Database and login. Baked in at build time.",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
      note: "Needed for customers to open their report page.",
    },
    {
      name: "RESEND_API_KEY",
      set: Boolean(process.env.RESEND_API_KEY),
      required: true,
      note: "Sends customer email. Separate from the landing page's key.",
    },
    {
      name: "EMAIL_FROM",
      set: Boolean(process.env.EMAIL_FROM),
      required: true,
      note: "Must be Fludd <onboarding@resend.dev> until a domain is verified.",
    },
    {
      name: "DEV_EMAIL_OVERRIDE",
      set: Boolean(override),
      required: false,
      note: override
        ? `All customer email is being redirected to ${override}.`
        : "OFF — customer email goes to real customers. Only safe with a verified Resend domain.",
    },
  ];
}

export function ConfigHealth() {
  const rows = checks();
  const missing = rows.filter((c) => c.required && !c.set);
  const overrideOff = rows.find((c) => c.name === "DEV_EMAIL_OVERRIDE" && !c.set);

  return (
    <div className="rounded-card bg-card p-5 shadow-sm ring-1 ring-line">
      <h2 className="text-lg">This deployment</h2>
      <p className="mt-1 mb-4 text-sm text-ink-soft">
        What the server can see right now. Values are never shown — only whether
        they are set.
      </p>

      <ul className="flex flex-col gap-2.5">
        {rows.map((check) => (
          <li key={check.name} className="flex gap-2 text-sm">
            <span
              aria-hidden
              className={
                check.set
                  ? "font-bold text-ok"
                  : check.required
                    ? "font-bold text-err"
                    : "text-warn"
              }
            >
              {check.set ? "✓" : check.required ? "✗" : "!"}
            </span>
            <span className="min-w-0">
              <span className="font-mono text-[13px] break-all">{check.name}</span>
              <span className="sr-only">{check.set ? " is set" : " is not set"}</span>
              <span className="block text-xs text-ink-faint">{check.note}</span>
            </span>
          </li>
        ))}
      </ul>

      {missing.length > 0 ? (
        <p
          role="alert"
          className="mt-4 rounded-sm bg-warn-tint px-3 py-2 text-sm font-medium text-warn"
        >
          {missing.length} required setting{missing.length === 1 ? " is" : "s are"}{" "}
          missing on this deployment. Add {missing.length === 1 ? "it" : "them"} in
          the Vercel project&apos;s environment variables, then redeploy —
          changing a variable does not affect a build that already happened.
        </p>
      ) : overrideOff ? (
        <p className="mt-4 rounded-sm bg-warn-tint px-3 py-2 text-sm font-medium text-warn">
          Customer email is live. Every finished visit will email the real pool
          owner.
        </p>
      ) : (
        <p className="mt-4 rounded-sm bg-ok-tint px-3 py-2 text-sm font-medium text-ok-deep">
          Everything this deployment needs is configured.
        </p>
      )}
    </div>
  );
}
