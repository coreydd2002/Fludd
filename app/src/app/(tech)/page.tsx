import Link from "next/link";

import { ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireTech } from "@/lib/auth";
import { directionsUrl } from "@/lib/maps";
import { createClient } from "@/lib/supabase/server";

import { startVisit } from "./visits/actions";

export const metadata = { title: "Today's route" };

export default async function RoutePage({ searchParams }: PageProps<"/">) {
  const { tech, company } = await requireTech();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();

  // An unfinished visit is the most important thing on this screen — a tech who
  // backgrounds the app at a pool must land straight back in it.
  const { data: openVisit } = await supabase
    .from("visits")
    .select("id, customer_id, started_at, customers(first_name, last_name, address)")
    .in("status", ["on_the_way", "in_progress"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase
    .from("customers")
    .select(
      "id, first_name, last_name, address, est_duration_minutes, internal_notes",
    )
    .eq("archived", false)
    .order("first_name");

  if (search) {
    // Row-level security still scopes this; the filter only narrows further.
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
    );
  }

  const { data: customers, error } = await query;

  // One query for the whole list rather than one per pool. RLS scopes it to the
  // company, and the join gives us which customer each piece of feedback is for.
  const { data: unreadFeedback } = await supabase
    .from("feedback")
    .select("is_urgent, next_visit_notes, visits(customer_id)")
    .is("read_by_tech_at", null);

  const waiting = new Map<string, { urgent: boolean; hasNotes: boolean }>();
  for (const f of unreadFeedback ?? []) {
    const id = f.visits?.customer_id;
    if (!id) continue;
    const prev = waiting.get(id) ?? { urgent: false, hasNotes: false };
    waiting.set(id, {
      urgent: prev.urgent || f.is_urgent,
      hasNotes: prev.hasNotes || Boolean(f.next_visit_notes),
    });
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const openCustomerId = openVisit?.customer_id;

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Eyebrow>Today</Eyebrow>
          <h1 className="mt-1 text-2xl">
            {greeting}, {tech.display_name}
          </h1>
        </div>
        <ButtonLink href="/customers/new" className="shrink-0 px-4 text-sm">
          Add pool
        </ButtonLink>
      </div>

      {openVisit ? (
        <Link
          href={`/visits/${openVisit.id}`}
          className="mt-5 block rounded-card bg-gradient-to-br from-brand to-aqua p-5 text-white shadow-md"
        >
          <p className="text-[11px] font-bold tracking-wider uppercase opacity-80">
            Visit in progress
          </p>
          <p className="mt-1 text-xl font-extrabold">
            {[openVisit.customers?.first_name, openVisit.customers?.last_name]
              .filter(Boolean)
              .join(" ")}
          </p>
          <p className="mt-0.5 text-sm opacity-90">
            {openVisit.customers?.address}
          </p>
          <p className="mt-3 inline-flex min-h-tap items-center rounded-pill bg-white/20 px-4 text-sm font-bold">
            Continue visit →
          </p>
        </Link>
      ) : null}

      <form className="mt-5" role="search">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search pools by name"
          aria-label="Search pools by name"
          className="min-h-tap w-full rounded-pill bg-card px-4 py-2.5 text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-brand focus:outline-none"
        />
      </form>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-sm bg-err/10 px-3 py-2 text-sm text-err"
        >
          Could not load your pools: {error.message}
        </p>
      ) : null}

      <div className="mt-5">
        {customers && customers.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {customers.map((customer) => {
              const name = [customer.first_name, customer.last_name]
                .filter(Boolean)
                .join(" ");
              const isOpen = customer.id === openCustomerId;
              const flag = waiting.get(customer.id);

              return (
                <li
                  key={customer.id}
                  className="rounded-card bg-card p-4 shadow-sm ring-1 ring-line"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-bold text-ink hover:text-brand-dark"
                      >
                        {name}
                      </Link>
                      <p className="mt-0.5 truncate text-sm text-ink-soft">
                        {customer.address}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        About {customer.est_duration_minutes} min
                      </p>
                    </div>
                    <a
                      href={directionsUrl(customer.address, company.maps_pref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-tap shrink-0 items-center rounded-pill bg-brand-tint px-4 text-sm font-bold text-brand-dark"
                    >
                      Directions
                    </a>
                  </div>

                  {flag ? (
                    <Link
                      href="/inbox"
                      className={`mt-3 flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-bold ring-1 ${
                        flag.urgent
                          ? "bg-warn-tint text-warn ring-warn/30"
                          : "bg-brand-tint text-brand-dark ring-brand/20"
                      }`}
                    >
                      {flag.urgent
                        ? "Urgent issue reported"
                        : flag.hasNotes
                          ? "Notes waiting for your next visit"
                          : "New feedback"}
                      <span aria-hidden className="ml-auto">
                        →
                      </span>
                    </Link>
                  ) : null}

                  {customer.internal_notes ? (
                    <p className="mt-3 rounded-sm bg-brand-tint-2 px-3 py-2 text-sm text-ink-soft">
                      {customer.internal_notes}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    {isOpen ? (
                      <ButtonLink
                        href={`/visits/${openVisit?.id}`}
                        className="w-full"
                      >
                        Continue visit
                      </ButtonLink>
                    ) : (
                      <form action={startVisit}>
                        <input
                          type="hidden"
                          name="customer_id"
                          value={customer.id}
                        />
                        <button
                          type="submit"
                          disabled={Boolean(openVisit)}
                          className="min-h-tap w-full rounded-pill bg-brand px-5 font-bold text-white hover:bg-brand-dark active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
                        >
                          On my way
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : search ? (
          <EmptyState
            title="No pools match that search"
            body={`Nothing found for “${search}”.`}
            action={
              <ButtonLink href="/" variant="secondary">
                Clear search
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No pools yet"
            body="Add your first customer and Fludd will copy your default checklist onto their pool."
            action={
              <ButtonLink href="/customers/new">Add your first pool</ButtonLink>
            }
          />
        )}
      </div>

      {openVisit ? (
        <p className="mt-5 text-center text-xs text-ink-faint">
          Finish or cancel the visit in progress before starting another.
        </p>
      ) : null}
    </>
  );
}
