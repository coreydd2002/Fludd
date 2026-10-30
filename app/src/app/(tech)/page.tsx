import Link from "next/link";

import { ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireTech } from "@/lib/auth";
import { directionsUrl } from "@/lib/maps";
import { localDateISO, weekdayName, weekdayOf } from "@/lib/routing/schedule";
import { createClient } from "@/lib/supabase/server";

import { duePoolsFor, moveStop } from "./routes/actions";
import { startVisit } from "./visits/actions";

export const metadata = { title: "Today's route" };

export default async function RoutePage() {
  const { tech, company } = await requireTech();
  const supabase = await createClient();

  // Every date decision is made in the company's timezone. Using the server's
  // clock would roll a Phoenix company onto tomorrow's route each evening.
  const today = localDateISO(new Date(), company.timezone);

  // An unfinished visit is the most important thing on this screen — a tech who
  // backgrounds the app at a pool must land straight back in it.
  const { data: openVisit } = await supabase
    .from("visits")
    .select("id, customer_id, started_at, customers(first_name, last_name, address)")
    .in("status", ["on_the_way", "in_progress"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const duePools = await duePoolsFor(tech.id, today);

  // If the tech has already ordered today, honour it. The route is created on
  // first interaction, not on render, so most mornings there is none yet and
  // the list falls back to alphabetical.
  const { data: route } = await supabase
    .from("routes")
    .select("id, route_stops(customer_id, position, status)")
    .eq("tech_id", tech.id)
    .eq("service_date", today)
    .maybeSingle();

  const orderOf = new Map<string, number>(
    (route?.route_stops ?? []).map((s) => [s.customer_id, s.position]),
  );
  const stops =
    orderOf.size > 0
      ? [...duePools].sort(
          (a, b) =>
            (orderOf.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (orderOf.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        )
      : duePools;

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

  // Also from the company's zone, so the greeting agrees with the route.
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: company.timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const openCustomerId = openVisit?.customer_id;
  const dayName = weekdayName(weekdayOf(today));
  const totalMinutes = stops.reduce((sum, p) => sum + p.est_duration_minutes, 0);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Eyebrow>{dayName}</Eyebrow>
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
          className="rounded-card from-brand to-aqua mt-5 block bg-gradient-to-br p-5 text-white shadow-md"
        >
          <p className="text-[11px] font-bold tracking-wider uppercase opacity-80">
            Visit in progress
          </p>
          <p className="mt-1 text-xl font-extrabold">
            {[openVisit.customers?.first_name, openVisit.customers?.last_name]
              .filter(Boolean)
              .join(" ")}
          </p>
          <p className="mt-0.5 text-sm opacity-90">{openVisit.customers?.address}</p>
          <p className="min-h-tap rounded-pill mt-3 inline-flex items-center bg-white/20 px-4 text-sm font-bold">
            Continue visit →
          </p>
        </Link>
      ) : null}

      {stops.length > 0 ? (
        <p className="text-ink-soft mt-5 text-sm">
          <span className="text-ink font-bold">
            {stops.length} {stops.length === 1 ? "pool" : "pools"}
          </span>{" "}
          · about {Math.round(totalMinutes / 60)}h {totalMinutes % 60}m of service time
        </p>
      ) : null}

      <div className="mt-4">
        {stops.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {stops.map((customer, index) => {
              const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
              const isOpen = customer.id === openCustomerId;
              const flag = waiting.get(customer.id);

              return (
                <li
                  key={customer.id}
                  className="rounded-card bg-card ring-line p-4 shadow-sm ring-1"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="bg-brand-tint text-brand-dark rounded-pill mt-0.5 grid size-7 shrink-0 place-items-center text-sm font-bold"
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="hover:text-brand-dark text-ink font-bold"
                      >
                        {name}
                      </Link>
                      <p className="text-ink-soft mt-0.5 truncate text-sm">{customer.address}</p>
                      <p className="text-ink-faint mt-0.5 text-xs">
                        About {customer.est_duration_minutes} min
                      </p>
                    </div>

                    {/* Up/down rather than drag: this is used one-handed on a
                        phone, where dragging inside a scrolling page is
                        unreliable and inaccessible. */}
                    <div className="flex shrink-0 flex-col">
                      <form action={moveStop}>
                        <input type="hidden" name="customer_id" value={customer.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={index === 0}
                          aria-label={`Move ${name} earlier`}
                          className="text-ink-faint hover:text-brand px-2 disabled:opacity-30"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveStop}>
                        <input type="hidden" name="customer_id" value={customer.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === stops.length - 1}
                          aria-label={`Move ${name} later`}
                          className="text-ink-faint hover:text-brand px-2 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </form>
                    </div>

                    <a
                      href={directionsUrl(customer.address, company.maps_pref)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-tap rounded-pill bg-brand-tint text-brand-dark inline-flex shrink-0 items-center px-4 text-sm font-bold"
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
                    <p className="bg-brand-tint-2 text-ink-soft mt-3 rounded-sm px-3 py-2 text-sm">
                      {customer.internal_notes}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    {isOpen ? (
                      <ButtonLink href={`/visits/${openVisit?.id}`} className="w-full">
                        Continue visit
                      </ButtonLink>
                    ) : (
                      <form action={startVisit}>
                        <input type="hidden" name="customer_id" value={customer.id} />
                        <button
                          type="submit"
                          disabled={Boolean(openVisit)}
                          className="min-h-tap rounded-pill bg-brand hover:bg-brand-dark w-full px-5 font-bold text-white active:translate-y-px disabled:pointer-events-none disabled:opacity-40"
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
        ) : (
          <EmptyState
            title={`Nothing scheduled for ${dayName}`}
            body="Pools appear here on the weekday they're assigned to. Open a pool and set its service day, or add a new one."
            action={<ButtonLink href="/customers">See all pools</ButtonLink>}
          />
        )}
      </div>

      {openVisit ? (
        <p className="text-ink-faint mt-5 text-center text-xs">
          Finish or cancel the visit in progress before starting another.
        </p>
      ) : null}
    </>
  );
}
