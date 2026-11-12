import { scrubDeep } from "./scrub";

/**
 * The Sentry options shared by the server, edge and browser initialisations.
 *
 * Kept in one file so the scrubbing rule cannot be applied in some runtimes and
 * forgotten in others — a report token leaking from the browser is exactly as
 * bad as one leaking from the server.
 *
 * The DSN is read from the environment and is *not* required: with no DSN,
 * `Sentry.init` is never called and the app runs untouched. That keeps local
 * development, CI and anyone's fork free of a mandatory third-party account,
 * matching how `sendOwnerEmail` treats missing email configuration.
 */
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sharedSentryOptions = {
  dsn: sentryDsn,

  // Errors are the point. Traces are sampled low because this is a pilot with a
  // handful of users and the free tier is small; raise it when there is a
  // performance question worth asking.
  tracesSampleRate: 0.1,

  // Off: session replay would record the visit screen, which shows customer
  // names, addresses and pool photos.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Do not let the SDK attach the request body or cookies; a Server Action
  // payload can carry customer detail and the session cookie is a credential.
  sendDefaultPii: false,

  /**
   * Last gate before anything leaves the process. Sweeping the whole event
   * rather than named fields means a future SDK version that adds another
   * URL-bearing field is covered without a code change here.
   *
   * Generic rather than typed to `ErrorEvent`: the browser, Node and edge
   * builds each expect their own event type, and the SDK does not re-export
   * those names from this entry point. Returning exactly what came in
   * satisfies all three.
   */
  beforeSend<T>(event: T): T {
    return scrubDeep(event);
  },

  beforeBreadcrumb<T>(breadcrumb: T): T {
    return scrubDeep(breadcrumb);
  },
};
