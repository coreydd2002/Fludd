/**
 * Public configuration — safe to reach the browser.
 *
 * Next inlines `process.env.NEXT_PUBLIC_*` at build time only when the property
 * is written out in full, so these must not be read through a dynamic key.
 *
 * Nothing throws at module load. A missing value would otherwise fail
 * `next build` on a machine that has no .env.local, which turns "you haven't
 * configured Supabase yet" into a broken build rather than a clear message at
 * the point of use.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function assertSupabaseEnv(): void {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — see README.md.",
    );
  }
}

/**
 * Absolute origin used to build links that leave the app (the report link in
 * every finish email). Falls back to the Vercel-assigned URL so preview
 * deploys produce working links before a custom domain exists.
 */
export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");
