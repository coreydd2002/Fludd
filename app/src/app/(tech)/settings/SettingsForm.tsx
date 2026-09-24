"use client";

import { useActionState } from "react";

import { ChecklistEditor } from "@/components/ChecklistEditor";
import { Button, Card, Field, FormError, Input } from "@/components/ui";

import { saveSettings, type SettingsState } from "./actions";

export function SettingsForm({
  displayName,
  businessName,
  alertEmail,
  mapsPref,
  checklist,
}: {
  displayName: string;
  businessName: string;
  alertEmail: string;
  mapsPref: string;
  checklist: string[];
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveSettings,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Card>
        <h2 className="text-lg">Your business</h2>
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Your name" hint="Shown to customers." htmlFor="display_name">
            <Input id="display_name" name="display_name" defaultValue={displayName} required />
          </Field>
          <Field label="Business name" htmlFor="business_name">
            <Input id="business_name" name="business_name" defaultValue={businessName} required />
          </Field>
          <Field
            label="Alert email"
            hint="Where urgent issues from customers are sent."
            htmlFor="alert_email"
          >
            <Input
              id="alert_email"
              name="alert_email"
              type="email"
              inputMode="email"
              defaultValue={alertEmail}
              required
            />
          </Field>
          <Field label="Directions open in" htmlFor="maps_pref">
            <select
              id="maps_pref"
              name="maps_pref"
              defaultValue={mapsPref}
              className="w-full rounded-sm bg-card px-3 py-2.5 text-ink ring-1 ring-line min-h-tap focus:ring-2 focus:ring-brand focus:outline-none"
            >
              <option value="google">Google Maps</option>
              <option value="apple">Apple Maps</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg">Default checklist</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">
          Used for pools you add from now on. Pools you already added keep their
          own checklist.
        </p>
        <ChecklistEditor initial={checklist} />
      </Card>

      <FormError>{state.error}</FormError>
      {state.saved ? (
        <p
          role="status"
          className="rounded-sm bg-ok-tint px-3 py-2 text-sm font-medium text-ok-deep"
        >
          Settings saved.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
