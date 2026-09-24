import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase sends people after they click a link in an auth email —
 * confirming a new account, or resetting a password.
 *
 * Supabase verifies the token on its own domain and then bounces the browser
 * here. Landing on a page is not enough: the session only exists once this
 * route trades the token for cookies, which is why the app needs a route
 * handler rather than just a redirect target.
 *
 * Two token shapes arrive here, and both are handled:
 *
 *   ?token_hash=...&type=signup   the current Supabase email templates
 *   ?code=...                     the PKCE flow
 *
 * token_hash is the more robust of the two. PKCE stores a verifier in a cookie
 * when signup starts, so the code can only be redeemed by the same browser —
 * and people routinely sign up on a laptop and open the email on a phone.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  const supabase = await createClient();
  let failure: string | null = null;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "invite" | "email_change" | "magiclink",
      token_hash: tokenHash,
    });
    failure = error?.message ?? null;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failure = error?.message ?? null;
  } else {
    failure = "That link is missing its confirmation token.";
  }

  return NextResponse.redirect(
    failure ? new URL("/login?confirm=failed", origin(request)) : new URL(safeNext(next), origin(request)),
  );
}

/**
 * Behind Vercel's proxy the request URL carries an internal hostname, so
 * redirecting to it would send the browser somewhere it cannot reach. The
 * forwarded host is the one the user actually typed.
 */
function origin(request: Request): string {
  const url = new URL(request.url);
  if (process.env.NODE_ENV === "development") return url.origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return url.origin;
}

/** Only ever redirect within this site, never to a URL the query string supplied. */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
