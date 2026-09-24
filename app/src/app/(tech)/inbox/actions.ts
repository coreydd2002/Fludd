"use server";

import { revalidatePath } from "next/cache";

import { requireTech } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks feedback as seen.
 *
 * Row-level security limits these to the caller's own company, so no company_id
 * filter is needed here — and adding one would imply the policy were optional.
 */
export async function markRead(formData: FormData) {
  await requireTech();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("feedback")
    .update({ read_by_tech_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_by_tech_at", null);

  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function markAllRead() {
  await requireTech();

  const supabase = await createClient();
  await supabase
    .from("feedback")
    .update({ read_by_tech_at: new Date().toISOString() })
    .is("read_by_tech_at", null);

  revalidatePath("/inbox");
  revalidatePath("/");
}
