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
      <div className="rounded-card bg-card ring-line p-6 text-center shadow-sm ring-1">
        <h1 className="text-xl">Something went wrong</h1>
        <p className="text-ink-soft mt-2 text-sm">
          Nothing you saved has been lost. Try again, and if it keeps happening your visit is still
          recorded — you can finish it later.
        </p>

        <button
          type="button"
          onClick={reset}
          className="min-h-tap rounded-pill bg-brand hover:bg-brand-dark mt-5 w-full px-5 font-bold text-white"
        >
          Try again
        </button>

        {/* A full page load, not <Link>. The router has just failed to render
            something; a client-side navigation asks that same machinery to
            work, and if it cannot the tech is stuck on this screen. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="min-h-tap rounded-pill text-ink-soft ring-line mt-3 inline-flex w-full items-center justify-center px-5 font-bold ring-1"
        >
          Back to today&apos;s route
        </a>

        {error.digest ? (
          <p className="text-ink-faint mt-4 font-mono text-[11px]">Reference: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
