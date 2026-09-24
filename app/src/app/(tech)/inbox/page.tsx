import Link from "next/link";

import { EmptyState, Eyebrow } from "@/components/ui";
import { requireTech } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { markAllRead, markRead } from "./actions";

export const metadata = { title: "Feedback" };

export default async function InboxPage() {
  const { company } = await requireTech();
  const supabase = await createClient();

  const { data: feedback } = await supabase
    .from("feedback")
    .select(
      "id, created_at, rating, review, next_visit_notes, is_urgent, read_by_tech_at, visits(finished_at, customer_id, customers(first_name, last_name))",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = feedback ?? [];
  const unread = rows.filter((f) => !f.read_by_tech_at);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Eyebrow>From your customers</Eyebrow>
          <h1 className="mt-1 text-2xl">Feedback</h1>
        </div>
        {unread.length > 0 ? (
          <form action={markAllRead}>
            <button
              type="submit"
              className="shrink-0 text-sm font-bold text-brand-dark underline underline-offset-2"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-5">
        {rows.length === 0 ? (
          <EmptyState
            title="No feedback yet"
            body="After you finish a visit, the pool owner gets a report with a link to leave a rating or a note. Anything they send shows up here."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((item) => {
              const isUnread = !item.read_by_tech_at;
              const customer = item.visits?.customers;
              const name =
                [customer?.first_name, customer?.last_name]
                  .filter(Boolean)
                  .join(" ") || "A customer";
              const serviced = item.visits?.finished_at
                ? new Date(item.visits.finished_at).toLocaleDateString("en-US", {
                    timeZone: company.timezone,
                    dateStyle: "medium",
                  })
                : null;

              return (
                <li
                  key={item.id}
                  className={`rounded-card p-4 shadow-sm ring-1 ${
                    item.is_urgent
                      ? "bg-warn-tint ring-warn/30"
                      : isUnread
                        ? "bg-brand-tint-2 ring-brand/25"
                        : "bg-card ring-line"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {item.visits?.customer_id ? (
                          <Link
                            href={`/customers/${item.visits.customer_id}`}
                            className="hover:text-brand-dark"
                          >
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                        {item.is_urgent ? (
                          <span className="rounded-pill bg-warn px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                            Urgent
                          </span>
                        ) : null}
                        {isUnread && !item.is_urgent ? (
                          <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                            New
                          </span>
                        ) : null}
                      </p>
                      {serviced ? (
                        <p className="text-xs text-ink-faint">Serviced {serviced}</p>
                      ) : null}
                    </div>

                    {item.rating ? (
                      <p
                        className="shrink-0 text-sm font-bold text-brand"
                        aria-label={`Rated ${item.rating} out of 5`}
                      >
                        <span aria-hidden>{"★".repeat(item.rating)}</span>
                        <span aria-hidden className="text-ink-faint">
                          {"☆".repeat(5 - item.rating)}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {item.review ? (
                    <p className="mt-3 text-sm whitespace-pre-wrap text-ink">
                      {item.review}
                    </p>
                  ) : null}

                  {item.next_visit_notes ? (
                    <div className="mt-3 rounded-sm bg-card/70 px-3 py-2 ring-1 ring-line">
                      <p className="text-[11px] font-bold tracking-wider text-ink-soft uppercase">
                        For next visit
                      </p>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap text-ink">
                        {item.next_visit_notes}
                      </p>
                    </div>
                  ) : null}

                  {isUnread ? (
                    <form action={markRead} className="mt-3">
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="text-sm font-bold text-brand-dark underline underline-offset-2"
                      >
                        Mark as read
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rows.length > 0 ? (
        <p className="mt-5 text-center text-xs text-ink-faint">
          Notes for next visit also appear at the top of that pool&apos;s next
          visit screen.
        </p>
      ) : null}
    </>
  );
}
