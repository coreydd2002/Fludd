"use server";

import { redirect } from "next/navigation";

import { parseChecklist } from "@/lib/checklist";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businessName = String(formData.get("business_name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const checklist = parseChecklist(formData.get("checklist"));

  if (!businessName) return { error: "Enter your business name." };
  if (!displayName) return { error: "Enter the name your customers should see." };

  // Creates the company, the tech row and a starter checklist in one
  // transaction. It refuses if this account already onboarded, which is what
  // makes a double submit safe.
  const { data: companyId, error } = await supabase.rpc("bootstrap_company", {
    p_business_name: businessName,
    p_display_name: displayName,
    p_timezone: timezone || "America/Los_Angeles",
  });

  if (error) {
    if (error.message.includes("already completed onboarding")) redirect("/");
    return { error: error.message };
  }

  // bootstrap_company seeds the five standard items. Replace them with whatever
  // the tech actually submitted.
  await supabase.from("default_checklist_items").delete().eq("company_id", companyId);
  if (checklist.length > 0) {
    await supabase.from("default_checklist_items").insert(
      checklist.map((label, position) => ({
        company_id: companyId as string,
        label,
        position,
      })),
    );
  }

  redirect("/");
}
