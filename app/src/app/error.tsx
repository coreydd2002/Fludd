"use client";

import { useEffect } from "react";

/**
 * Catches a render failure anywhere in the app.
 *
 * Deliberately does not show the raw error: a tech standing at a pool cannot
 * act on a stack trace, and it may carry internals. The digest is displayed
 * because it is the one token that ties a report back to the server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-12">
      <div className="rounded-card bg-card p-6 text-center shadow-sm ring-1 ring-line">
        <h1 className="text-xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Nothing you saved has been lost. Try again, and if it keeps happening
          your visit is still recorded — you can finish it later.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-5 min-h-tap w-full rounded-pill bg-brand px-5 font-bold text-white hover:bg-brand-dark"
        >
          Try again
        </button>

        {/* A full page load, not <Link>. The router has just failed to render
            something; a client-side navigation asks that same machinery to
            work, and if it cannot the tech is stuck on this screen. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="mt-3 inline-flex min-h-tap w-full items-center justify-center rounded-pill px-5 font-bold text-ink-soft ring-1 ring-line"
        >
          Back to today&apos;s route
        </a>

        {error.digest ? (
          <p className="mt-4 font-mono text-[11px] text-ink-faint">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
