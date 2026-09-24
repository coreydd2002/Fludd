"use client";

import { useActionState, useEffect, useRef } from "react";

import { ChecklistEditor } from "@/components/ChecklistEditor";
import { Button, Card, Field, FormError, Input } from "@/components/ui";

import { completeOnboarding, type OnboardingState } from "./actions";

const DEFAULT_CHECKLIST = [
  "Skim surface",
  "Brush walls",
  "Vacuum",
  "Test & balance chemicals",
  "Empty baskets",
];

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const tzRef = useRef<HTMLInputElement>(null);

  // Owner-facing emails and reports render times in the company's zone, so it
  // is captured once here from the browser rather than asked for.
  useEffect(() => {
    if (tzRef.current) {
      tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    }
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input ref={tzRef} type="hidden" name="timezone" defaultValue="" />

      <Card>
        <h1 className="text-xl">Set up your business</h1>
        <div className="mt-5 flex flex-col gap-4">
          <Field
            label="Business name"
            hint="Shown at the bottom of every customer report."
            htmlFor="business_name"
          >
            <Input id="business_name" name="business_name" required autoComplete="organization" />
          </Field>
          <Field
            label="Your name"
            hint="What customers see — usually just a first name, like Marcus."
            htmlFor="display_name"
          >
            <Input id="display_name" name="display_name" required autoComplete="given-name" />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg">Default checklist</h2>
        <p className="mt-1 mb-4 text-sm text-ink-soft">
          Applied to every new pool you add. You can change it per pool later.
        </p>
        <ChecklistEditor initial={DEFAULT_CHECKLIST} />
      </Card>

      <FormError>{state.error}</FormError>

      <Button type="submit" disabled={pending}>
        {pending ? "Setting up…" : "Finish setup"}
      </Button>
    </form>
  );
}
