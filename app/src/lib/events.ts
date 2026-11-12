import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The events worth counting, as a union.
 *
 * The column itself is free text so the vocabulary can grow without a
 * migration, but every call site goes through this type — a typo becomes a
 * compile error rather than a silently separate series that splits a metric in
 * two.
 */
export type EventName =
  /** The route screen was opened. The closest thing we have to "used today". */
  | "today_viewed"
  | "visit_started"
  | "visit_completed"
  /** A pool was given, or moved to, a service day. */
  | "pool_scheduled"
  /** A stop was moved by hand. Falling counts mean the saved order is trusted. */
  | "route_reordered";

/**
 * Records one product event.
 *
 * **It never throws.** Measuring is always a side effect of something more
 * important — a tech starting a visit, a pool being scheduled — and losing a
 * count must never cost the work itself. This is the same contract
 * `sendOwnerEmail` keeps, for the same reason.
 *
 * It is also deliberately not awaited at most call sites: the row is useful for
 * a weekly query, never for the response being rendered.
 */
export async function logEvent({
  name,
  companyId,
  techId = null,
  customerId = null,
  props = {},
}: {
  name: EventName;
  companyId: string;
  techId?: string | null;
  customerId?: string | null;
  props?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("app_events").insert({
      name,
      company_id: companyId,
      tech_id: techId,
      customer_id: customerId,
      props,
    });
    // A policy or network failure is worth seeing in the logs, but it is not
    // worth failing the request that triggered it.
    if (error) console.error("[events] insert failed", name, error.message);
  } catch (cause) {
    console.error("[events] insert threw", name, cause);
  }
}
