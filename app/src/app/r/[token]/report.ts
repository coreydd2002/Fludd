import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Everything the public report page is allowed to know.
 *
 * This type is the privacy boundary. The visit row it is built from carries the
 * owner's last name, address, email and the tech's private notes (gate codes,
 * "dog in yard"); none of those appear here, so they cannot reach the page even
 * by accident. Anyone widening this type is widening what a link-holder sees.
 */
export type PublicReport = {
  ownerFirstName: string;
  techName: string;
  businessName: string;
  servicedAt: string;
  readings: {
    chlorine_ppm: number | null;
    ph: number | null;
    alkalinity_ppm: number | null;
  };
  items: { label: string; completed: boolean }[];
  photoUrls: string[];
  techNotes: string | null;
  feedbackOpen: boolean;
  alreadySubmitted: boolean;
};

export type ReportLookup =
  | { state: "ok"; report: PublicReport }
  | { state: "invalid" }
  | { state: "not_finished" };

/**
 * Resolves a report token.
 *
 * Uses the service role because the reader has no session — row-level security
 * would refuse them everything. The token is the entire credential, which is
 * why it is 32 random bytes and why this returns the same "invalid" for a
 * malformed token as for one that simply does not exist: distinguishing them
 * would let someone probe for real tokens.
 */
export async function loadReport(token: string): Promise<ReportLookup> {
  if (!token || token.length < 20 || token.length > 100) return { state: "invalid" };

  const supabase = createAdminClient();

  const { data: visit } = await supabase
    .from("visits")
    // One string literal, not a concatenation: supabase-js parses this at the
    // type level, and a joined string collapses every column to `unknown`.
    .select(
      "id, status, finished_at, tech_notes, chlorine_ppm, ph, alkalinity_ppm, feedback_closes_at, customers(first_name), techs(display_name), companies(business_name, timezone)",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (!visit) return { state: "invalid" };

  // A visit still in progress has a token but no report yet. Cancelled visits
  // never get one at all.
  if (visit.status !== "completed" || !visit.finished_at) {
    return visit.status === "cancelled" ? { state: "invalid" } : { state: "not_finished" };
  }

  const [{ data: items }, { data: photos }, { data: feedback }] = await Promise.all([
    supabase
      .from("visit_items")
      .select("label, completed")
      .eq("visit_id", visit.id)
      .order("position"),
    supabase
      .from("visit_photos")
      .select("storage_path")
      .eq("visit_id", visit.id)
      .order("position"),
    supabase.from("feedback").select("id").eq("visit_id", visit.id).maybeSingle(),
  ]);

  // The bucket is private; these URLs are minted per request and expire.
  let photoUrls: string[] = [];
  if (photos && photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from("visit-photos")
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        SIGNED_URL_TTL_SECONDS,
      );
    photoUrls = (signed ?? [])
      .map((s) => s.signedUrl)
      .filter((u): u is string => Boolean(u));
  }

  const timezone = visit.companies?.timezone ?? "America/Los_Angeles";
  const closesAt = visit.feedback_closes_at
    ? new Date(visit.feedback_closes_at)
    : null;

  return {
    state: "ok",
    report: {
      ownerFirstName: visit.customers?.first_name ?? "there",
      techName: visit.techs?.display_name ?? "your pool tech",
      businessName: visit.companies?.business_name ?? "your pool service",
      servicedAt: new Date(visit.finished_at).toLocaleString("en-US", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "short",
      }),
      readings: {
        chlorine_ppm: visit.chlorine_ppm,
        ph: visit.ph,
        alkalinity_ppm: visit.alkalinity_ppm,
      },
      items: items ?? [],
      photoUrls,
      techNotes: visit.tech_notes,
      // The report stays readable forever; only the form closes. Losing your
      // service history because a month passed would be its own bug.
      feedbackOpen: Boolean(closesAt && closesAt > new Date()) && !feedback,
      alreadySubmitted: Boolean(feedback),
    },
  };
}
