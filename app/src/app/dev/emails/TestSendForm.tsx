"use client";

import { useActionState } from "react";

import { Button, Input } from "@/components/ui";

import { sendTestEmail, type TestSendState } from "./actions";

const TONE = {
  ok: "bg-ok-tint text-ok-deep",
  warn: "bg-warn-tint text-warn",
  info: "bg-brand-tint-2 text-ink-soft",
} as const;

export function TestSendForm({
  template,
  defaultTo,
}: {
  template: string;
  defaultTo: string;
}) {
  const [state, formAction, pending] = useActionState<TestSendState, FormData>(
    sendTestEmail,
    {},
  );

  return (
    <form action={formAction} className="mt-4 rounded-card bg-card p-4 ring-1 ring-line">
      <input type="hidden" name="template" value={template} />
      <label htmlFor="to" className="text-sm font-bold">
        Send this one to yourself
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input
          id="to"
          name="to"
          type="email"
          inputMode="email"
          defaultValue={defaultTo}
          placeholder="you@example.com"
          className="flex-1 min-w-[220px]"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send test"}
        </Button>
      </div>

      {state.message ? (
        <p
          role="status"
          className={`mt-3 rounded-sm px-3 py-2 text-sm font-medium ${TONE[state.tone ?? "info"]}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
