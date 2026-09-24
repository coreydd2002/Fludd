import { requireTech } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { ConfigHealth } from "./ConfigHealth";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { tech, company } = await requireTech();

  const supabase = await createClient();
  const { data: defaults } = await supabase
    .from("default_checklist_items")
    .select("label")
    .eq("company_id", company.id)
    .order("position");

  return (
    <>
      <h1 className="text-2xl">Settings</h1>
      <div className="mt-5">
        <SettingsForm
          displayName={tech.display_name}
          businessName={company.business_name}
          alertEmail={company.alert_email}
          mapsPref={company.maps_pref}
          checklist={(defaults ?? []).map((d) => d.label)}
        />
      </div>

      <div className="mt-8">
        <ConfigHealth />
      </div>
    </>
  );
}
