import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Shared primitives. Sizing is driven by `min-h-tap` (48px) rather than padding
 * alone, because the target user is tapping these one-handed, outdoors, often
 * with wet hands.
 */

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill px-5 font-bold " +
  "min-h-tap transition-transform active:translate-y-px disabled:opacity-50 " +
  "disabled:pointer-events-none";

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-card text-ink ring-1 ring-line hover:bg-brand-tint-2",
  danger: "bg-card text-err ring-1 ring-line hover:bg-err/5",
} as const;

type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card bg-card p-5 shadow-sm ring-1 ring-line ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
        {label}
      </label>
      {hint ? <p className="text-xs text-ink-faint -mt-1">{hint}</p> : null}
      {children}
    </div>
  );
}

const control =
  "w-full rounded-sm bg-card px-3 py-2.5 text-ink ring-1 ring-line " +
  "min-h-tap placeholder:text-ink-faint focus:ring-2 focus:ring-brand " +
  "focus:outline-none";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${control} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-24 ${className}`} {...props} />;
}

/** Inline form error. `role="alert"` so a screen reader announces it on submit. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-sm bg-err/10 px-3 py-2 text-sm font-medium text-err"
    >
      {children}
    </p>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <h2 className="eyebrow">{children}</h2>;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card bg-brand-tint-2 px-5 py-10 text-center ring-1 ring-line">
      <p className="font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
