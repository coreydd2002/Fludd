"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; notice?: string };

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? "") || "/",
  };
}

/** Only ever redirect to a path on this site — never to a URL the form supplied. */
function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Deliberately vague: distinguishing "no such account" from "wrong password"
  // would confirm to a stranger which email addresses are registered.
  if (error) return { error: "That email and password don't match." };

  redirect(safeNext(next));
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  // No session means one of two things, and Supabase deliberately makes them
  // indistinguishable: either the account is new and awaiting confirmation, or
  // it already exists — in which case nothing is sent at all. Telling them
  // apart would let anyone probe this form for registered addresses, so the
  // message has to cover both rather than promise an email that may never come.
  if (!data.session) {
    return {
      notice:
        "If that address is new, a confirmation link is on its way — click it, " +
        "then sign in. If you already have an account, just sign in; no new " +
        "email is sent for an address that's already registered.",
    };
  }

  redirect("/onboarding");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
