import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Set up" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // Already onboarded? Nothing to do here.
  const supabase = await createClient();
  const { data: tech } = await supabase
    .from("techs")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (tech) redirect("/");

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-8">
      <OnboardingForm />
    </main>
  );
}
