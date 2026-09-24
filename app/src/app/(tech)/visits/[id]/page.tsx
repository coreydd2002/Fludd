import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EmailNotice } from "@/components/EmailNotice";
import { requireTech } from "@/lib/auth";
import { directionsUrl } from "@/lib/maps";
import { createClient } from "@/lib/supabase/server";

import { cancelVisit, finishVisit } from "../actions";
import type { PhotoItem } from "./PhotoStrip";
import { VisitScreen } from "./VisitScreen";

export const metadata = { title: "Visit" };

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function VisitPage({
  params,
  searchParams,
}: PageProps<"/visits/[id]">) {
  const { id } = await params;
  const { email, why, to } = await searchParams;
  const { company } = await requireTech();
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from("visits")
    .select("*, customers(first_name, last_name, address, internal_notes)")
    .eq("id", id)
    .maybeSingle();
  if (!visit) notFound();

  if (visit.status === "completed") redirect(`/visits/${id}/done`);
  if (visit.status === "cancelled") redirect("/");

  const [{ data: items }, { data: photos }] = await Promise.all([
    supabase
      .from("visit_items")
      .select("id, label, completed")
      .eq("visit_id", id)
      .order("position"),
    supabase
      .from("visit_photos")
      .select("id, storage_path")
      .eq("visit_id", id)
      .order("position"),
  ]);

  // The bucket is private, so each render mints fresh short-lived URLs rather
  // than storing anything publicly reachable.
  let photoItems: PhotoItem[] = [];
  if (photos && photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from("visit-photos")
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        SIGNED_URL_TTL_SECONDS,
      );
    photoItems = photos.map((p, i) => ({
      id: p.id,
      storage_path: p.storage_path,
      url: signed?.[i]?.signedUrl ?? "",
    }));
  }

  const customer = visit.customers;
  const name = [customer?.first_name, customer?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl">{name}</h1>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            {customer?.address}
          </p>
        </div>
        <a
          href={directionsUrl(customer?.address ?? "", company.maps_pref)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-tap shrink-0 items-center rounded-pill bg-brand-tint px-4 text-sm font-bold text-brand-dark"
        >
          Directions
        </a>
      </div>

      <EmailNotice
        status={typeof email === "string" ? email : undefined}
        reason={typeof why === "string" ? why : undefined}
        redirectedTo={typeof to === "string" ? to : undefined}
        sentLabel={`"On my way" email sent to ${customer?.first_name ?? "the owner"}.`}
      />

      {customer?.internal_notes ? (
        <p className="mt-4 rounded-card bg-brand-tint-2 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
          <span className="font-bold text-ink">Private note · </span>
          {customer.internal_notes}
        </p>
      ) : null}

      <div className="mt-5">
        <VisitScreen
          visitId={visit.id}
          companyId={company.id}
          initialItems={items ?? []}
          initialNotes={visit.tech_notes ?? ""}
          initialReadings={{
            chlorine_ppm: visit.chlorine_ppm,
            ph: visit.ph,
            alkalinity_ppm: visit.alkalinity_ppm,
          }}
          initialPhotos={photoItems}
        />
      </div>

      <form action={finishVisit} className="mt-6">
        <input type="hidden" name="visit_id" value={visit.id} />
        <button
          type="submit"
          className="min-h-tap w-full rounded-pill bg-brand px-5 py-4 text-lg font-bold text-white hover:bg-brand-dark active:translate-y-px"
        >
          Finish visit
        </button>
        <p className="mt-2 text-center text-xs text-ink-faint">
          Unchecked services are reported as not done today.
        </p>
      </form>

      <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
        <Link href="/" className="text-sm font-bold text-ink-soft">
          ← Back to route
        </Link>
        <form action={cancelVisit}>
          <input type="hidden" name="visit_id" value={visit.id} />
          <button
            type="submit"
            className="text-sm font-bold text-err underline underline-offset-2"
          >
            Cancel this visit
          </button>
        </form>
      </div>
    </>
  );
}
