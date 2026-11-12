import * as Sentry from "@sentry/nextjs";

import { sentryDsn, sharedSentryOptions } from "@/lib/sentry-options";

/**
 * Browser-side error reporting.
 *
 * Worth having separately from the server side: the visit screen does real work
 * in the browser — photo compression, the offline-tolerant save queue — and a
 * failure there never reaches the server to be logged.
 *
 * Runs before the app becomes interactive. Guarded because a monitoring tool
 * that breaks the page it is monitoring is worse than no monitoring at all.
 */
if (sentryDsn) {
  try {
    Sentry.init(sharedSentryOptions);
  } catch (cause) {
    console.error("[sentry] client init failed", cause);
  }
}

/** Lets Sentry tie a client error to the navigation that produced it. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
