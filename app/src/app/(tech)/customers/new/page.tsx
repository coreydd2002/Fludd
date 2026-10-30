import { requireTech } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { createCustomer } from "../actions";
import { CustomerForm } from "../CustomerForm";

export const metadata = { title: "Add a pool" };

export default async function NewCustomerPage() {
  const { company } = await requireTech();

  // Pre-fill from the company default so a new pool starts with the right
  // checklist; it becomes an independent copy once saved.
  const supabase = await createClient();
  const { data: defaults } = await supabase
    .from("default_checklist_items")
    .select("label")
    .eq("company_id", company.id)
    .order("position");

  // The roster this pool can be assigned to. RLS scopes it to the company, so
  // no company_id filter is needed.
  const { data: techs } = await supabase
    .from("techs")
    .select("id, display_name")
    .order("display_name");

  return (
    <>
      <h1 className="text-2xl">Add a pool</h1>
      <div className="mt-5">
        <CustomerForm
          action={createCustomer}
          checklist={(defaults ?? []).map((d) => d.label)}
          techs={techs ?? []}
          submitLabel="Add pool"
        />
      </div>
    </>
  );
}
