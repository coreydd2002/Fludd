import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Still the anon key, so row-level security applies — this is the client that
 * should back everything a signed-in tech does.
 *
 * A new client per request: the session cookie belongs to one request, and
 * @supabase/ssr only emits its no-store cache headers on a client's first
 * cookie write.
 */
export async function createClient() {
  // cookies() first, deliberately. Awaiting it is what tells Next this route is
  // dynamic and must not be prerendered. Asserting before it means a build
  // without Supabase credentials throws during static generation — an
  // unbuildable app — instead of deferring the complaint to a real request,
  // where it is both actionable and correct.
  const cookieStore = await cookies();
  assertSupabaseEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Refreshing the session is
          // the proxy's job (src/proxy.ts), so the write is safe to drop here.
        }
      },
    },
  });
}
