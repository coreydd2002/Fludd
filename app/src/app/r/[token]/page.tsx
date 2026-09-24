import type { Metadata } from "next";

import { allReadingsHealthy, formatReading, READINGS, statusOf } from "@/lib/readings";

import { FeedbackForm } from "./FeedbackForm";
import { loadReport } from "./report";

// A report is addressed by an unguessable token; it must never be indexed, and
// the title must not leak anything about whose pool it is.
export const metadata: Metadata = {
  title: "Your pool service",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReportPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const lookup = await loadReport(token);

  if (lookup.state === "invalid") return <Shell>{invalidBody}</Shell>;
  if (lookup.state === "not_finished") return <Shell>{notFinishedBody}</Shell>;

  const r = lookup.report;
  const healthy = allReadingsHealthy(r.readings);
  const done = r.items.filter((i) => i.completed);
  const skipped = r.items.filter((i) => !i.completed);
  const anyReading = READINGS.some(
    (spec) => statusOf(spec, r.readings[spec.key]) !== "empty",
  );

  return (
    <Shell>
      <header>
        <p className="eyebrow">Your latest service</p>
        <h1 className="mt-1 text-2xl">Hi {r.ownerFirstName}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Serviced by {r.techName} · {r.servicedAt}
        </p>
      </header>

      {anyReading ? (
        <section className="mt-6">
          <div className="grid grid-cols-3 gap-2">
            {READINGS.map((spec) => {
              const value = r.readings[spec.key];
              const status = statusOf(spec, value);
              return (
                <div
                  key={spec.key}
                  className="rounded-card bg-card p-3 text-center shadow-sm ring-1 ring-line"
                >
                  <p className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">
                    {spec.short}
                  </p>
                  <p className="mt-0.5 text-2xl font-extrabold tracking-tight">
                    {formatReading(spec, value)}
                  </p>
                  <p className="text-[11px] text-ink-faint">
                    {status === "empty"
                      ? "not tested"
                      : status === "ok"
                        ? "in range"
                        : status === "low"
                          ? "below range"
                          : "above range"}
                  </p>
                </div>
              );
            })}
          </div>

          {healthy ? (
            <p className="mt-2 rounded-card bg-ok-tint px-4 py-3 text-sm font-bold text-ok-deep ring-1 ring-ok/20">
              ✓ All readings in the healthy range
            </p>
          ) : null}
        </section>
      ) : null}

      {r.items.length > 0 ? (
        <section className="mt-6 rounded-card bg-card p-5 shadow-sm ring-1 ring-line">
          <h2 className="eyebrow">What was done</h2>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {done.map((item) => (
              <li key={item.label} className="flex gap-2">
                <span aria-hidden className="font-bold text-ok">
                  ✓
                </span>
                <span>{item.label}</span>
              </li>
            ))}
            {skipped.map((item) => (
              <li key={item.label} className="flex gap-2 text-ink-faint">
                <span aria-hidden>—</span>
                <span>{item.label} (not done today)</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.photoUrls.length > 0 ? (
        <section className="mt-6">
          <h2 className="eyebrow">Photos from today</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {r.photoUrls.map((url, i) => (
              // Signed storage URLs expire, so they cannot go through the
              // Next image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`Pool service photo ${i + 1}`}
                loading="lazy"
                className="aspect-square w-full rounded-sm object-cover ring-1 ring-line"
              />
            ))}
          </div>
        </section>
      ) : null}

      {r.techNotes ? (
        <section className="mt-6 rounded-card bg-brand-tint-2 p-5 ring-1 ring-line">
          <h2 className="eyebrow">A note from {r.techName}</h2>
          <p className="mt-2 text-sm whitespace-pre-wrap text-ink">{r.techNotes}</p>
        </section>
      ) : null}

      <hr className="mt-8 border-line" />

      <section className="mt-6">
        {r.alreadySubmitted ? (
          <p className="rounded-card bg-ok-tint px-4 py-3 text-sm font-medium text-ok-deep ring-1 ring-ok/20">
            Thanks — you&apos;ve already sent feedback for this visit.
          </p>
        ) : r.feedbackOpen ? (
          <>
            <h2 className="text-xl">How did it go?</h2>
            <p className="mt-1 mb-4 text-sm text-ink-soft">
              Goes straight to {r.businessName}. Private — never published.
            </p>
            <FeedbackForm token={token} />
          </>
        ) : (
          <p className="rounded-card bg-brand-tint-2 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
            Feedback for this visit has closed — it stays open until your next
            service. This report will keep working.
          </p>
        )}
      </section>

      <p className="mt-8 text-center text-xs text-ink-faint">
        {r.businessName} · sent with Fludd
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[560px] px-5 py-8">{children}</main>;
}

// Identical response for a malformed token and one that does not exist, so the
// page cannot be used to test whether a guessed token is real.
const invalidBody = (
  <div className="rounded-card bg-card p-8 text-center shadow-sm ring-1 ring-line">
    <h1 className="text-xl">This link isn&apos;t valid</h1>
    <p className="mt-2 text-sm text-ink-soft">
      It may have been mistyped or replaced by a newer one. The most recent
      email from your pool service will have a working link.
    </p>
  </div>
);

const notFinishedBody = (
  <div className="rounded-card bg-card p-8 text-center shadow-sm ring-1 ring-line">
    <h1 className="text-xl">Your service isn&apos;t finished yet</h1>
    <p className="mt-2 text-sm text-ink-soft">
      This report fills in once your tech completes the visit. You&apos;ll get an
      email the moment it&apos;s ready.
    </p>
  </div>
);
