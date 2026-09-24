"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ChecklistEditor } from "@/components/ChecklistEditor";
import { Button, Card, Field, FormError, Input, Textarea } from "@/components/ui";

import type { CustomerState } from "./actions";

type Values = {
  id?: string;
  first_name?: string;
  last_name?: string | null;
  email?: string;
  address?: string;
  est_duration_minutes?: number;
  start_email_enabled?: boolean;
  internal_notes?: string | null;
};

export function CustomerForm({
  action,
  values = {},
  checklist,
  submitLabel,
}: {
  action: (prev: CustomerState, formData: FormData) => Promise<CustomerState>;
  values?: Values;
  checklist: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Card>
        <h2 className="text-lg">Customer</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="first_name">
              <Input id="first_name" name="first_name" defaultValue={values.first_name} required />
            </Field>
            <Field label="Last name" htmlFor="last_name">
              <Input id="last_name" name="last_name" defaultValue={values.last_name ?? ""} />
            </Field>
          </div>

          <Field
            label="Email"
            hint="Where the service report goes after every visit."
            htmlFor="email"
          >
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={values.email}
              required
            />
          </Field>

          <Field label="Address" hint="Used for the Directions button." htmlFor="address">
            <Input id="address" name="address" defaultValue={values.address} required />
          </Field>

          <Field label="Estimated time (minutes)" htmlFor="est_duration_minutes">
            <Input
              id="est_duration_minutes"
              name="est_duration_minutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              defaultValue={values.est_duration_minutes ?? 30}
              required
            />
          </Field>

          <label className="flex items-center gap-3 rounded-sm bg-brand-tint-2 px-3 py-3 min-h-tap">
            <input
              type="checkbox"
              name="start_email_enabled"
              defaultChecked={values.start_email_enabled ?? true}
              className="size-5 accent-[var(--color-brand)]"
            />
            <span className="text-sm">
              <span className="font-bold">Send an &ldquo;on my way&rdquo; email</span>
              <span className="block text-ink-soft">
                Emailed when you start a visit at this pool.
              </span>
            </span>
          </label>

          <Field
            label="Private notes"
            hint="Only you see this. Gate code, dog in the yard, where the key is."
            htmlFor="internal_notes"
          >
            <Textarea
              id="internal_notes"
              name="internal_notes"
              defaultValue={values.internal_notes ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg">Checklist for this pool</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">
          Starts from your default checklist. Changing it here only affects this
          pool, and never changes a report from a past visit.
        </p>
        <ChecklistEditor initial={checklist} />
      </Card>

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link
          href="/"
          className="inline-flex min-h-tap items-center justify-center rounded-pill px-5 font-bold text-ink-soft ring-1 ring-line"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
