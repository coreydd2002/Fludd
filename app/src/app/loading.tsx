/**
 * Shown while a server-rendered page is fetching. Every authed screen hits
 * Supabase before it can render, and on a phone at the side of a house that is
 * not instant — a blank screen reads as a broken app.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto w-full max-w-[560px] px-5 py-8"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-40 animate-pulse rounded-sm bg-line" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-card bg-card p-4 shadow-sm ring-1 ring-line"
          >
            <div className="h-4 w-32 animate-pulse rounded-sm bg-line" />
            <div className="mt-2 h-3 w-48 animate-pulse rounded-sm bg-line/70" />
            <div className="mt-4 h-tap w-full animate-pulse rounded-pill bg-line/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
