"use client";

import { useActionState } from "react";

import { Button, Card, Field, FormError, Input } from "@/components/ui";

import { inviteTeammate, type TeamState } from "./actions";

const select =
  "min-h-tap bg-card text-ink ring-line focus:ring-brand w-full rounded-sm px-3 py-2.5 ring-1 focus:ring-2 focus:outline-none";

/**
 * Invites somebody by email.
 *
 * The outcome is shown as a notice rather than an error even when the send
 * fails, because the invitation itself still exists — the link is on the
 * roster below and can be passed on by hand.
 */
export function InviteForm() {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(inviteTeammate, {});

  return (
    <Card>
      <h2 className="text-lg">Invite someone</h2>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <Field
          label="Email"
          hint="They must sign up with this address — the invitation only works for it."
          htmlFor="email"
        >
          <Input id="email" name="email" type="email" required autoComplete="off" />
        </Field>

        <Field
          label="Role"
          hint="Owners can manage people and company settings. Cleaners see their own route."
          htmlFor="role"
        >
          <select id="role" name="role" defaultValue="tech" className={select}>
            <option value="tech">Cleaner</option>
            <option value="owner">Owner</option>
          </select>
        </Field>

        <FormError>{state.error}</FormError>

        {state.notice ? (
          <p className="bg-brand-tint text-brand-dark rounded-sm px-3 py-2 text-sm font-medium">
            {state.notice}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </form>
    </Card>
  );
}
