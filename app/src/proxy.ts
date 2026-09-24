import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Paths reachable without a session. Everything else requires one.
 *
 * /dev/ is here only so the email preview is frictionless while building; the
 * route itself calls notFound() when NODE_ENV is production, so it cannot be
 * reached on a deployed app regardless of this list.
 */
const PUBLIC_PREFIXES = ["/login", "/signup", "/r/", "/auth/", "/dev/"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
  );
}

/**
 * Refreshes the Supabase session on every request and bounces logged-out
 * visitors to /login.
 *
 * Access tokens are short-lived, so without this a tech who leaves the app
 * open at a pool comes back to a dead session. The refreshed cookie has to be
 * written onto the *response*, which Server Components cannot do — this is the
 * only place in the app that can.
 *
 * Note this does NOT check whether onboarding is finished; that needs a
 * database round trip and would run on every asset request. The authed layout
 * handles it instead.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Supabase sends no-store headers with the first cookie write. Without
        // them a CDN could cache one tech's session cookie and hand it to
        // someone else.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // So the tech lands back where they were headed after signing in.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own assets and any static file in public/.
    //
    // Matching on the extension rather than naming each file matters for the
    // PWA: an installable app needs its manifest and icons fetchable without a
    // session, and a newly added icon that got auth-gated would fail silently —
    // the install prompt simply never appears.
    "/((?!_next/static|_next/image|.*\.(?:png|jpg|jpeg|gif|svg|ico|webmanifest|txt|xml)$).*)",
  ],
};
