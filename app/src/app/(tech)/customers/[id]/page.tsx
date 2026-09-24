import { notFound } from "next/navigation";

import { requireTech } from "@/lib/auth";
import { directionsUrl } from "@/lib/maps";
import { createClient } from "@/lib/supabase/server";

import { archiveCustomer, updateCustomer } from "../actions";
import { CustomerForm } from "../CustomerForm";

export const metadata = { title: "Edit pool" };

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const { company } = await requireTech();

  const supabase = await createClient();
  // RLS makes this return nothing for another company's customer, so a guessed
  // id is a 404 rather than a leak.
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  const { data: items } = await supabase
    .from("customer_checklist_items")
    .select("label")
    .eq("customer_id", id)
    .order("position");

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl">
          {[customer.first_name, customer.last_name].filter(Boolean).join(" ")}
        </h1>
        <a
          href={directionsUrl(customer.address, company.maps_pref)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex min-h-tap items-center rounded-pill bg-brand-tint px-4 text-sm font-bold text-brand-dark"
        >
          Directions
        </a>
      </div>

      <div className="mt-5">
        <CustomerForm
          action={updateCustomer}
          values={customer}
          checklist={(items ?? []).map((i) => i.label)}
          submitLabel="Save changes"
        />
      </div>

      <form action={archiveCustomer} className="mt-8 border-t border-line pt-5">
        <input type="hidden" name="id" value={customer.id} />
        <button
          type="submit"
          className="text-sm font-bold text-err underline underline-offset-2"
        >
          Archive this pool
        </button>
        <p className="mt-1 text-xs text-ink-faint">
          Hides it from your route. Past visits and any reports already sent stay
          intact.
        </p>
      </form>
    </>
  );
}
