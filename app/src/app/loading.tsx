/**
 * Shown while a server-rendered page is fetching. Every authed screen hits
 * Supabase before it can render, and on a phone at the side of a house that is
 * not instant — a blank screen reads as a broken app.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-[560px] px-5 py-8">
      <span className="sr-only">Loading…</span>
      <div className="bg-line h-7 w-40 animate-pulse rounded-sm" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card bg-card ring-line p-4 shadow-sm ring-1">
            <div className="bg-line h-4 w-32 animate-pulse rounded-sm" />
            <div className="bg-line/70 mt-2 h-3 w-48 animate-pulse rounded-sm" />
            <div className="h-tap rounded-pill bg-line/50 mt-4 w-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
