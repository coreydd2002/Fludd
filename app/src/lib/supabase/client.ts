import { createBrowserClient } from "@supabase/ssr";

import { assertSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";

import type { Database } from "./database.types";

/**
 * Supabase client for Client Components. Reads and writes are constrained by
 * the row-level security policies in supabase/migrations — this key is public
 * and is expected to be in the browser bundle.
 */
export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
