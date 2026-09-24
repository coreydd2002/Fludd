"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { parseChecklist } from "@/lib/checklist";
import { createClient } from "@/lib/supabase/server";


export type SettingsState = { error?: string; saved?: boolean };

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { tech, company } = await requireTech();

  const displayName = String(formData.get("display_name") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const alertEmail = String(formData.get("alert_email") ?? "").trim();
  const mapsPref = String(formData.get("maps_pref") ?? "google");
  const checklist = parseChecklist(formData.get("checklist"));

  if (!displayName) return { error: "Enter the name your customers should see." };
  if (!businessName) return { error: "Enter your business name." };
  if (!alertEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)) {
    return { error: "Enter a valid email for urgent alerts." };
  }
  if (mapsPref !== "google" && mapsPref !== "apple") {
    return { error: "Pick either Google Maps or Apple Maps." };
  }

  const supabase = await createClient();

  const { error: techError } = await supabase
    .from("techs")
    .update({ display_name: displayName })
    .eq("id", tech.id);
  if (techError) return { error: techError.message };

  const { error: companyError } = await supabase
    .from("companies")
    .update({
      business_name: businessName,
      alert_email: alertEmail,
      maps_pref: mapsPref,
    })
    .eq("id", company.id);
  if (companyError) return { error: companyError.message };

  // Only touches the default list. Pools already added keep their own copy —
  // that is the point of copying the checklist at create time.
  await supabase.from("default_checklist_items").delete().eq("company_id", company.id);
  if (checklist.length > 0) {
    await supabase.from("default_checklist_items").insert(
      checklist.map((label, position) => ({ company_id: company.id, label, position })),
    );
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return { saved: true };
}
