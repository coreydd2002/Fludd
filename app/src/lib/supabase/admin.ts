import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { assertSupabaseEnv, supabaseUrl } from "@/lib/env";
import { serviceRoleKey } from "@/lib/env.server";

import type { Database } from "./database.types";

/**
 * Service-role Supabase client. **Bypasses row-level security entirely.**
 *
 * Only three things may use it:
 *   1. looking a visit up by its `public_token` for the public report page,
 *   2. signing short-lived URLs for photos in the private `visit-photos` bucket,
 *   3. inserting feedback submitted by a pool owner, who has no session.
 *
 * Everything a signed-in tech does goes through `./server` instead, so that RLS
 * — not application code — is what keeps one company's data away from another.
 * Never pass a value derived from this client to a Client Component without
 * narrowing it to the fields the public page is allowed to show.
 */
export function createAdminClient() {
  assertSupabaseEnv();
  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
