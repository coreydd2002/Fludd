import { notFound } from "next/navigation";

import { EmailNotice } from "@/components/EmailNotice";
import { ButtonLink } from "@/components/ui";
import { requireTech } from "@/lib/auth";
import { allReadingsHealthy, formatReading, READINGS, statusOf } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Visit complete" };

export default async function VisitDonePage({
  params,
  searchParams,
}: PageProps<"/visits/[id]/done">) {
  const { id } = await params;
  const { email, why, to } = await searchParams;
  const { company } = await requireTech();
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from("visits")
    .select("*, customers(first_name, last_name)")
    .eq("id", id)
    .maybeSingle();
  if (!visit) notFound();

  const { data: items } = await supabase
    .from("visit_items")
    .select("label, completed")
    .eq("visit_id", id)
    .order("position");

  const done = (items ?? []).filter((i) => i.completed);
  const skipped = (items ?? []).filter((i) => !i.completed);

  const readings = {
    chlorine_ppm: visit.chlorine_ppm,
    ph: visit.ph,
    alkalinity_ppm: visit.alkalinity_ppm,
  };

  // Rendered in the company's zone, not the server's — the same rule the
  // owner-facing report and emails follow.
  const finished = visit.finished_at
    ? new Date(visit.finished_at).toLocaleString("en-US", {
        timeZone: company.timezone,
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const name = [visit.customers?.first_name, visit.customers?.last_name].filter(Boolean).join(" ");

  return (
    <>
      <div className="rounded-card bg-ok-tint ring-ok/30 p-5 ring-1">
        <h1 className="text-ok-deep text-2xl">Visit complete</h1>
        <p className="text-ok-deep/80 mt-1 text-sm">
          {name}
          {finished ? ` · ${finished}` : null}
        </p>
      </div>

      <div className="rounded-card bg-card ring-line mt-5 p-5 shadow-sm ring-1">
        <h2 className="eyebrow">Readings</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {READINGS.map((spec) => (
            <div key={spec.key} className="bg-brand-tint-2 rounded-sm p-3 text-center">
              <p className="text-ink-soft text-[11px] font-bold tracking-wider uppercase">
                {spec.short}
              </p>
              <p className="text-xl font-extrabold">{formatReading(spec, readings[spec.key])}</p>
              {statusOf(spec, readings[spec.key]) === "empty" ? (
                <p className="text-ink-faint text-[11px]">not tested</p>
              ) : null}
            </div>
          ))}
        </div>

        {allReadingsHealthy(readings) ? (
          <p className="bg-ok-tint text-ok-deep mt-3 rounded-sm px-3 py-2 text-sm font-medium">
            All readings in the healthy range
          </p>
        ) : null}

        <h2 className="eyebrow mt-5">Services</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {done.map((i) => (
            <li key={i.label} className="text-ink">
              <span className="text-ok">✓</span> {i.label}
            </li>
          ))}
          {skipped.map((i) => (
            <li key={i.label} className="text-ink-faint">
              — {i.label} (not done today)
            </li>
          ))}
        </ul>

        {visit.tech_notes ? (
          <>
            <h2 className="eyebrow mt-5">Your notes</h2>
            <p className="text-ink-soft mt-2 text-sm whitespace-pre-wrap">{visit.tech_notes}</p>
          </>
        ) : null}
      </div>

      <EmailNotice
        status={typeof email === "string" ? email : undefined}
        reason={typeof why === "string" ? why : undefined}
        redirectedTo={typeof to === "string" ? to : undefined}
        sentLabel={`Report emailed to ${visit.customers?.first_name ?? "the owner"}.`}
      />

      <p className="rounded-card bg-brand-tint-2 text-ink-soft ring-line mt-4 px-4 py-3 text-sm ring-1">
        The report link in that email opens in Phase 4 — the address is already correct, so the
        email won&apos;t need resending.
      </p>

      <div className="mt-5">
        <ButtonLink href="/" className="w-full">
          Back to route
        </ButtonLink>
      </div>
    </>
  );
}
