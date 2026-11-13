import Link from "next/link";

import { Button, ButtonLink, Card, Eyebrow } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { acceptInvite } from "./actions";

export const metadata = { title: "Invitation" };

/**
 * The page an invitation link opens.
 *
 * Public, because the recipient usually has no account yet. It reads the
 * invite through `invite_preview`, a SECURITY DEFINER function returning only
 * the company name and the address it was sent to — RLS can tell a signed-out
 * visitor nothing, and the alternative is a page that cannot say who invited
 * them, which is indistinguishable from phishing.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;

  const supabase = await createClient();
  const { data: previews } = await supabase.rpc("invite_preview", { p_token: token });
  const invite = previews?.[0];

  if (!invite) {
    return (
      <Card>
        <h1 className="text-xl">This invitation has expired</h1>
        <p className="text-ink-soft mt-3 text-sm">
          Invitations last seven days and can only be used once. Ask whoever invited you to send a
          new one.
        </p>
        <div className="mt-5">
          <ButtonLink href="/login">Go to sign in</ButtonLink>
        </div>
      </Card>
    );
  }

  const user = await getUser();

  // Already in a company: accepting would be refused by the database anyway,
  // so say why rather than offering a button that cannot work.
  if (user) {
    const { data: tech } = await supabase
      .from("techs")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (tech) {
      return (
        <Card>
          <Eyebrow>{invite.business_name}</Eyebrow>
          <h1 className="mt-1 text-xl">You already belong to a company</h1>
          <p className="text-ink-soft mt-3 text-sm">
            An account can only be part of one company. To join {invite.business_name}, sign up
            again with a different email address.
          </p>
          <div className="mt-5">
            <ButtonLink href="/">Back to your route</ButtonLink>
          </div>
        </Card>
      );
    }

    const matches = user.email?.toLowerCase() === invite.email.toLowerCase();

    return (
      <Card>
        <Eyebrow>You&apos;ve been invited to</Eyebrow>
        <h1 className="mt-1 text-xl">{invite.business_name}</h1>

        {matches ? (
          <form action={acceptInvite} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <Button type="submit">Join {invite.business_name}</Button>
          </form>
        ) : (
          <>
            <p className="text-ink-soft mt-3 text-sm">
              This invitation was sent to <strong>{invite.email}</strong>, but you&apos;re signed in
              as <strong>{user.email}</strong>. Sign in with the invited address to accept it.
            </p>
            <p className="text-ink-faint mt-4 text-center text-xs">
              <Link href="/login" className="underline">
                Sign in as someone else
              </Link>
            </p>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <Eyebrow>You&apos;ve been invited to</Eyebrow>
      <h1 className="mt-1 text-xl">{invite.business_name}</h1>
      <p className="text-ink-soft mt-3 text-sm">
        Create an account with <strong>{invite.email}</strong> to join. The invitation only works
        for that address.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <ButtonLink href="/signup">Create an account</ButtonLink>
        <ButtonLink href={`/login?next=/invite/${token}`} variant="secondary">
          I already have one
        </ButtonLink>
      </div>
    </Card>
  );
}
