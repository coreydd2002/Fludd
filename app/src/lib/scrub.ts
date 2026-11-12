/**
 * Removes report tokens from anything on its way to an error tracker.
 *
 * A report link is `/r/<token>` and that token *is* the credential — anyone
 * holding it can read a customer's service history. `next.config.ts` already
 * sets `Referrer-Policy: no-referrer` on that route to stop it leaking onward;
 * sending the same URL to Sentry in an error report would walk straight around
 * that.
 *
 * Pure and dependency-free so the rule can be tested directly, because the cost
 * of getting it wrong is silent and permanent: once a token reaches a third
 * party's logs it cannot be recalled.
 */

/** `/r/<anything up to the next / ? or #>` — the report path and its token. */
const REPORT_PATH = /\/r\/[^/?#\s]+/g;

/**
 * Any parameter whose name contains "token": `token`, `access_token`, and
 * `token_hash`, which is the one `/auth/callback` actually receives.
 */
const TOKEN_PARAM = /\b([a-z_]*token[a-z_]*)=[^&\s#]+/gi;

export function scrubUrl(input: string): string {
  return input.replace(REPORT_PATH, "/r/[token]").replace(TOKEN_PARAM, "$1=[redacted]");
}

/**
 * Walks a value, scrubbing every string in it.
 *
 * Sentry events carry URLs in more places than `request.url` — breadcrumbs,
 * the message, tags — so the whole payload is swept rather than a named list
 * of fields that would drift as the SDK changes.
 */
export function scrubDeep<T>(value: T, depth = 0): T {
  // Events nest a few levels at most; the cap stops a cyclic object hanging the
  // error path, which would turn an error report into an outage.
  if (depth > 8) return value;
  if (typeof value === "string") return scrubUrl(value) as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v, depth + 1);
    return out as T;
  }
  return value;
}
