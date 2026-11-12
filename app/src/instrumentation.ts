import * as Sentry from "@sentry/nextjs";

import { sentryDsn, sharedSentryOptions } from "@/lib/sentry-options";

/**
 * Server-side error reporting.
 *
 * Runs once per server instance, before the first request. Until this existed,
 * a production failure reached us only when a user complained — which is how
 * the React-render email bug was found, after it had already cost real sends.
 *
 * With no DSN set this is a no-op, so local development and CI need no Sentry
 * account.
 */
export async function register() {
  if (!sentryDsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sharedSentryOptions);
  }
}

/**
 * Errors thrown while rendering or handling a request.
 *
 * Next calls this with the error after React may have already reprocessed it,
 * so the SDK's own helper is used rather than `captureException` — it knows how
 * to recover the original and attach the request context.
 */
export const onRequestError = Sentry.captureRequestError;
