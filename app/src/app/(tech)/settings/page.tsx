import Link from "next/link";

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

      {tech.role === "owner" ? (
        <Link
          href="/settings/team"
          className="rounded-card bg-card ring-line hover:ring-brand/30 mt-5 flex items-center justify-between gap-3 p-4 shadow-sm ring-1"
        >
          <span>
            <span className="text-ink block font-bold">Team</span>
            <span className="text-ink-soft mt-0.5 block text-sm">
              Invite cleaners, set who owns the account
            </span>
          </span>
          <span aria-hidden className="text-ink-faint">
            →
          </span>
        </Link>
      ) : null}

      <div className="mt-8">
        <ConfigHealth />
      </div>
    </>
  );
}
