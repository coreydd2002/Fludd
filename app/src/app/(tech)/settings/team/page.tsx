import Link from "next/link";

import { Eyebrow } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

import { changeActive, changeRole, revokeInvite } from "./actions";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Team" };

const ROLE_LABEL = { owner: "Owner", tech: "Cleaner" } as const;

/**
 * Who is in this company, and who has been asked to join.
 *
 * Owner-only, enforced three ways: `requireOwner` here, `requireOwner` in every
 * action, and the database itself — the `invites` policy and both management
 * functions re-check it. The page check is for the UI's benefit; the other two
 * are what make it true.
 */
export default async function TeamPage() {
  const { tech: me, company } = await requireOwner();
  const supabase = await createClient();

  const [{ data: roster }, { data: invites }] = await Promise.all([
    supabase
      .from("techs")
      .select("id, display_name, email, role, active")
      .eq("company_id", company.id)
      .order("role")
      .order("display_name"),
    supabase
      .from("invites")
      .select("id, email, role, token, expires_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const people = roster ?? [];
  const pending = invites ?? [];
  const activeOwners = people.filter((p) => p.role === "owner" && p.active).length;

  return (
    <>
      <div>
        <Eyebrow>{company.business_name}</Eyebrow>
        <h1 className="mt-1 text-2xl">Team</h1>
      </div>

      <div className="mt-5">
        <InviteForm />
      </div>

      <h2 className="mt-8 text-lg">
        People{" "}
        <span className="text-ink-faint text-sm font-normal">
          ({people.filter((p) => p.active).length} active)
        </span>
      </h2>

      <ul className="mt-3 flex flex-col gap-3">
        {people.map((person) => {
          const isMe = person.id === me.id;
          // The database refuses both of these; disabling them here means the
          // owner is told why before they click, rather than after.
          const lastOwner = person.role === "owner" && person.active && activeOwners === 1;

          return (
            <li
              key={person.id}
              className={`rounded-card bg-card ring-line p-4 shadow-sm ring-1 ${
                person.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink font-bold">
                    {person.display_name}
                    {isMe ? <span className="text-ink-faint font-normal"> · you</span> : null}
                  </p>
                  <p className="text-ink-soft mt-0.5 truncate text-sm">{person.email}</p>
                  <p className="text-ink-faint mt-1 text-xs font-bold">
                    {ROLE_LABEL[person.role]}
                    {person.active ? "" : " · access turned off"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!lastOwner ? (
                  <form action={changeRole}>
                    <input type="hidden" name="tech_id" value={person.id} />
                    <input
                      type="hidden"
                      name="role"
                      value={person.role === "owner" ? "tech" : "owner"}
                    />
                    <button
                      type="submit"
                      className="min-h-tap rounded-pill bg-brand-tint text-brand-dark px-4 text-sm font-bold"
                    >
                      {person.role === "owner" ? "Make cleaner" : "Make owner"}
                    </button>
                  </form>
                ) : null}

                {!isMe ? (
                  <form action={changeActive}>
                    <input type="hidden" name="tech_id" value={person.id} />
                    <input type="hidden" name="active" value={person.active ? "false" : "true"} />
                    <button
                      type="submit"
                      disabled={lastOwner}
                      className="min-h-tap rounded-pill ring-line text-ink-soft px-4 text-sm font-bold ring-1 disabled:opacity-40"
                    >
                      {person.active ? "Turn off access" : "Restore access"}
                    </button>
                  </form>
                ) : null}
              </div>

              {lastOwner ? (
                <p className="text-ink-faint mt-2 text-xs">
                  The only owner — promote someone else first.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pending.length > 0 ? (
        <>
          <h2 className="mt-8 text-lg">Waiting to accept</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((invite) => (
              <li key={invite.id} className="rounded-card bg-card ring-line p-4 shadow-sm ring-1">
                <p className="text-ink font-bold break-all">{invite.email}</p>
                <p className="text-ink-faint mt-0.5 text-xs font-bold">
                  {ROLE_LABEL[invite.role]} · expires{" "}
                  {new Date(invite.expires_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>

                {/* Shown so an invitation still works when email does not. */}
                <p className="text-ink-faint bg-brand-tint-2 mt-3 rounded-sm px-3 py-2 text-xs break-all">
                  {appUrl}/invite/{invite.token}
                </p>

                <form action={revokeInvite} className="mt-3">
                  <input type="hidden" name="invite_id" value={invite.id} />
                  <button
                    type="submit"
                    className="min-h-tap rounded-pill ring-line text-ink-soft px-4 text-sm font-bold ring-1"
                  >
                    Withdraw
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="text-ink-faint mt-8 text-center text-xs">
        <Link href="/settings" className="underline">
          Back to settings
        </Link>
      </p>
    </>
  );
}
