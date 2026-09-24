"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTech } from "@/lib/auth";
import { parseChecklist } from "@/lib/checklist";
import { createClient } from "@/lib/supabase/server";


export type CustomerState = { error?: string };

type Parsed = {
  values: {
    first_name: string;
    last_name: string | null;
    email: string;
    address: string;
    est_duration_minutes: number;
    start_email_enabled: boolean;
    internal_notes: string | null;
  };
  checklist: string[];
};

function parse(formData: FormData): Parsed | { error: string } {
  const first = String(formData.get("first_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const duration = Number(formData.get("est_duration_minutes") ?? 30);

  if (!first) return { error: "Enter the customer's first name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email — this is where the report is sent." };
  }
  if (!address) return { error: "Enter the address so Directions can work." };
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) {
    return { error: "Estimated time should be between 1 and 600 minutes." };
  }

  return {
    values: {
      first_name: first,
      last_name: String(formData.get("last_name") ?? "").trim() || null,
      email,
      address,
      est_duration_minutes: Math.round(duration),
      start_email_enabled: formData.get("start_email_enabled") === "on",
      internal_notes: String(formData.get("internal_notes") ?? "").trim() || null,
    },
    checklist: parseChecklist(formData.get("checklist")),
  };
}

/** Rewrites a pool's checklist to exactly the submitted list, in order. */
async function replaceChecklist(customerId: string, labels: string[]) {
  const supabase = await createClient();
  await supabase.from("customer_checklist_items").delete().eq("customer_id", customerId);
  if (labels.length > 0) {
    await supabase.from("customer_checklist_items").insert(
      labels.map((label, position) => ({ customer_id: customerId, label, position })),
    );
  }
}

export async function createCustomer(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const { company } = await requireTech();
  const parsed = parse(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.values, company_id: company.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await replaceChecklist(data.id, parsed.checklist);
  revalidatePath("/");
  redirect("/");
}

export async function updateCustomer(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  await requireTech();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing customer." };

  const parsed = parse(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  // No company_id filter needed — RLS already refuses rows from another company.
  const { error } = await supabase.from("customers").update(parsed.values).eq("id", id);
  if (error) return { error: error.message };

  await replaceChecklist(id, parsed.checklist);
  revalidatePath("/");
  redirect("/");
}

export async function archiveCustomer(formData: FormData) {
  await requireTech();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Archived, never deleted: past visits and the reports already emailed to
  // this owner must keep resolving.
  await supabase.from("customers").update({ archived: true }).eq("id", id);
  revalidatePath("/");
  redirect("/");
}
