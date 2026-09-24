import { notFound } from "next/navigation";

import { EmailNotice } from "@/components/EmailNotice";
import { ButtonLink } from "@/components/ui";
import { requireTech } from "@/lib/auth";
import {
  allReadingsHealthy,
  formatReading,
  READINGS,
  statusOf,
} from "@/lib/readings";
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

  const name = [visit.customers?.first_name, visit.customers?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="rounded-card bg-ok-tint p-5 ring-1 ring-ok/30">
        <h1 className="text-2xl text-ok-deep">Visit complete</h1>
        <p className="mt-1 text-sm text-ok-deep/80">
          {name}
          {finished ? ` · ${finished}` : null}
        </p>
      </div>

      <div className="mt-5 rounded-card bg-card p-5 shadow-sm ring-1 ring-line">
        <h2 className="eyebrow">Readings</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {READINGS.map((spec) => (
            <div
              key={spec.key}
              className="rounded-sm bg-brand-tint-2 p-3 text-center"
            >
              <p className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">
                {spec.short}
              </p>
              <p className="text-xl font-extrabold">
                {formatReading(spec, readings[spec.key])}
              </p>
              {statusOf(spec, readings[spec.key]) === "empty" ? (
                <p className="text-[11px] text-ink-faint">not tested</p>
              ) : null}
            </div>
          ))}
        </div>

        {allReadingsHealthy(readings) ? (
          <p className="mt-3 rounded-sm bg-ok-tint px-3 py-2 text-sm font-medium text-ok-deep">
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
            <p className="mt-2 text-sm whitespace-pre-wrap text-ink-soft">
              {visit.tech_notes}
            </p>
          </>
        ) : null}
      </div>

      <EmailNotice
        status={typeof email === "string" ? email : undefined}
        reason={typeof why === "string" ? why : undefined}
        redirectedTo={typeof to === "string" ? to : undefined}
        sentLabel={`Report emailed to ${visit.customers?.first_name ?? "the owner"}.`}
      />

      <p className="mt-4 rounded-card bg-brand-tint-2 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
        The report link in that email opens in Phase 4 — the address is already
        correct, so the email won&apos;t need resending.
      </p>

      <div className="mt-5">
        <ButtonLink href="/" className="w-full">
          Back to route
        </ButtonLink>
      </div>
    </>
  );
}
