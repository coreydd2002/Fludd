import "server-only";

/**
 * Server-only configuration.
 *
 * The `server-only` import above makes importing this file from a Client
 * Component a build error, which is the guard that keeps the service role key
 * and the Resend key out of the browser bundle.
 *
 * These are read lazily rather than at module load so that a missing key breaks
 * the one request that needs it, not every page in the app.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in — see README.md.`,
    );
  }
  return value;
}

/** Full-access Postgres key. Bypasses RLS — only for token lookups and sends. */
export function serviceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function resendApiKey(): string {
  return required("RESEND_API_KEY");
}

export function emailFrom(): string {
  return required("EMAIL_FROM");
}

/**
 * When set, every customer-facing email is redirected here instead of going to
 * the real pool owner. Required until a sending domain is verified in Resend,
 * because the shared `onboarding@resend.dev` sender can only deliver to the
 * Resend account's own address.
 */
export function devEmailOverride(): string | undefined {
  return process.env.DEV_EMAIL_OVERRIDE || undefined;
}
