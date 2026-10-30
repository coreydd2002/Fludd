"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { dueOn, localDateISO } from "@/lib/routing/schedule";
import { createClient } from "@/lib/supabase/server";

/**
 * The pools a tech should service on a given local date.
 *
 * Unassigned pools count as this tech's. A solo operator never opens the
 * "serviced by" dropdown, and an empty route on day one would read as the app
 * being broken rather than as a setup step they skipped.
 */
export async function duePoolsFor(techId: string, localDate: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, address, est_duration_minutes, internal_notes, service_weekday, service_cadence, service_week_parity",
    )
    .eq("archived", false)
    .or(`assigned_tech_id.eq.${techId},assigned_tech_id.is.null`)
    .order("first_name");

  return dueOn(data ?? [], localDate);
}

/**
 * Gets today's route, creating it and its stops on first use.
 *
 * Deliberately not called while rendering: creating rows is a side effect, and
 * a Server Component is a function React may re-run. It runs when the tech
 * actually does something — reordering, or starting the day.
 */
async function ensureRoute(techId: string, companyId: string, localDate: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("routes")
    .select("id")
    .eq("tech_id", techId)
    .eq("service_date", localDate)
    .maybeSingle();

  let routeId = existing?.id;

  if (!routeId) {
    const { data: created, error } = await supabase
      .from("routes")
      .insert({ company_id: companyId, tech_id: techId, service_date: localDate })
      .select("id")
      .single();

    if (error) {
      // Two taps can race past the check above; the unique index on
      // (tech_id, service_date) is what actually decides. Take whichever won.
      const { data: won } = await supabase
        .from("routes")
        .select("id")
        .eq("tech_id", techId)
        .eq("service_date", localDate)
        .maybeSingle();
      if (!won) throw new Error(error.message);
      routeId = won.id;
    } else {
      routeId = created.id;
    }
  }

  // Reconcile the stops against what is actually due. A pool can be added to
  // this weekday, or moved off it, after the route was first built.
  const due = await duePoolsFor(techId, localDate);
  const dueIds = new Set(due.map((p) => p.id));

  const { data: stops } = await supabase
    .from("route_stops")
    .select("id, customer_id, position, status")
    .eq("route_id", routeId)
    .order("position");

  const existingIds = new Set((stops ?? []).map((s) => s.customer_id));
  const nextPosition = (stops ?? []).length;

  const missing = due.filter((p) => !existingIds.has(p.id));
  if (missing.length > 0) {
    await supabase.from("route_stops").insert(
      missing.map((pool, i) => ({
        route_id: routeId,
        customer_id: pool.id,
        position: nextPosition + i,
      })),
    );
  }

  // Drop stops for pools no longer due — but never one already worked, which
  // is a record of what happened, not a plan.
  const stale = (stops ?? []).filter((s) => !dueIds.has(s.customer_id) && s.status === "pending");
  if (stale.length > 0) {
    await supabase
      .from("route_stops")
      .delete()
      .in(
        "id",
        stale.map((s) => s.id),
      );
  }

  return routeId;
}

/** Moves a stop one place up or down, renumbering the whole route. */
export async function moveStop(formData: FormData): Promise<void> {
  const { tech, company } = await requireTech();

  const customerId = String(formData.get("customer_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!customerId || (direction !== "up" && direction !== "down")) return;

  const localDate = localDateISO(new Date(), company.timezone);
  const routeId = await ensureRoute(tech.id, company.id, localDate);

  const supabase = await createClient();
  const { data: stops } = await supabase
    .from("route_stops")
    .select("id, customer_id, position")
    .eq("route_id", routeId)
    .order("position");

  if (!stops || stops.length < 2) return;

  const index = stops.findIndex((s) => s.customer_id === customerId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= stops.length) return;

  const reordered = [...stops];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  // Positions are rewritten for the whole route rather than swapping two
  // values, so a list that drifted out of 0..n-1 is repaired by any reorder.
  await Promise.all(
    reordered.map((stop, position) =>
      supabase.from("route_stops").update({ position }).eq("id", stop.id),
    ),
  );

  revalidatePath("/");
}
