"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { Button, Card, Field, FormError, Input } from "@/components/ui";

import { login, type AuthState } from "../actions";

function LoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <Card>
      <h1 className="text-xl">Sign in</h1>
      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
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
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <FormError>{state.error}</FormError>
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-5 text-sm text-ink-soft">
        No account yet?{" "}
        <Link href="/signup" className="font-bold text-brand-dark underline">
          Create one
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole route
  // into client-side rendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
