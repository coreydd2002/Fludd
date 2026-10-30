import Link from "next/link";

import { ButtonLink, EmptyState, Eyebrow } from "@/components/ui";
import { requireTech } from "@/lib/auth";
import { describeSchedule } from "@/lib/routing/schedule";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "All pools" };

/**
 * Every pool, scheduled or not.
 *
 * Today's route only shows what is due today, so this is the one place an
 * unscheduled pool can be found and given a day — without it, a pool added
 * without a weekday would be invisible forever.
 */
export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { company } = await requireTech();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select(
      "id, first_name, last_name, address, service_weekday, service_cadence, service_week_parity, assigned_tech_id",
    )
    .eq("archived", false)
    .order("first_name");

  if (search) {
    // Row-level security still scopes this; the filter only narrows further.
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const [{ data: customers, error }, { data: techs }] = await Promise.all([
    query,
    supabase.from("techs").select("id, display_name"),
  ]);

  const techName = new Map((techs ?? []).map((t) => [t.id, t.display_name]));
  const rows = customers ?? [];
  const unscheduled = rows.filter((c) => c.service_weekday === null).length;

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Eyebrow>{company.business_name}</Eyebrow>
          <h1 className="mt-1 text-2xl">All pools</h1>
        </div>
        <ButtonLink href="/customers/new" className="shrink-0 px-4 text-sm">
          Add pool
        </ButtonLink>
      </div>

      <form className="mt-5" role="search">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search pools by name"
          aria-label="Search pools by name"
          className="min-h-tap rounded-pill bg-card text-ink ring-line placeholder:text-ink-faint focus:ring-brand w-full px-4 py-2.5 ring-1 focus:ring-2 focus:outline-none"
        />
      </form>

      {error ? (
        <p role="alert" className="bg-err/10 text-err mt-5 rounded-sm px-3 py-2 text-sm">
          Could not load your pools: {error.message}
        </p>
      ) : null}

      {unscheduled > 0 && !search ? (
        <p className="bg-brand-tint-2 text-ink-soft ring-line mt-5 rounded-sm px-3 py-2 text-sm ring-1">
          {unscheduled} {unscheduled === 1 ? "pool has" : "pools have"} no service day, so{" "}
          {unscheduled === 1 ? "it never appears" : "they never appear"} on a route.
        </p>
      ) : null}

      <div className="mt-5">
        {rows.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {rows.map((customer) => {
              const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
              const scheduled = customer.service_weekday !== null;
              const assignee = customer.assigned_tech_id
                ? techName.get(customer.assigned_tech_id)
                : null;

              return (
                <li key={customer.id}>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="rounded-card bg-card ring-line hover:ring-brand/30 block p-4 shadow-sm ring-1"
                  >
                    <p className="text-ink font-bold">{name}</p>
                    <p className="text-ink-soft mt-0.5 truncate text-sm">{customer.address}</p>
                    <p
                      className={`mt-1.5 text-xs font-bold ${
                        scheduled ? "text-brand-dark" : "text-warn"
                      }`}
                    >
                      {describeSchedule(customer)}
                      {assignee ? ` · ${assignee}` : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : search ? (
          <EmptyState
            title="No pools match that search"
            body={`Nothing found for “${search}”.`}
            action={
              <ButtonLink href="/customers" variant="secondary">
                Clear search
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title="No pools yet"
            body="Add your first customer and Fludd will copy your default checklist onto their pool."
            action={<ButtonLink href="/customers/new">Add your first pool</ButtonLink>}
          />
        )}
      </div>
    </>
  );
}
