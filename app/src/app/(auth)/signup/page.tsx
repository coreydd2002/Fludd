"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button, Card, Field, FormError, Input } from "@/components/ui";

import { signup, type AuthState } from "../actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signup, {});

  return (
    <Card>
      <h1 className="text-xl">Create your account</h1>
      <p className="text-ink-soft mt-1 text-sm">
        One account per pool business. You&apos;ll set up your checklist next.
      </p>

      {state.notice ? (
        <p className="bg-ok-tint text-ok-deep mt-5 rounded-sm px-3 py-2 text-sm font-medium">
          {state.notice}
        </p>
      ) : (
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
            />
          </Field>
          <Field label="Password" hint="At least 8 characters." htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <FormError>{state.error}</FormError>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
      )}

      <p className="text-ink-soft mt-5 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-dark font-bold underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
