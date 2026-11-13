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
  const { data: tech } = await supabase.from("techs").select("id").eq("id", user.id).maybeSingle();
  if (tech) redirect("/");

  // Somebody who followed an invitation, created an account and confirmed
  // their email arrives here with the token long gone — signup carries no
  // redirect. Offering them the "name your business" form would have them
  // found a company of their own, one person alone, which is the exact thing
  // invitations exist to prevent. So look one up by their address instead.
  const { data: invites } = await supabase.rpc("my_pending_invite");
  const invite = invites?.[0];
  if (invite) redirect(`/invite/${invite.token}`);

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-8">
      <OnboardingForm />
    </main>
  );
}
