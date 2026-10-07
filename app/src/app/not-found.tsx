import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-12">
      <div className="rounded-card bg-card ring-line p-6 text-center shadow-sm ring-1">
        <h1 className="text-xl">Page not found</h1>
        <p className="text-ink-soft mt-2 text-sm">
          That link may be out of date, or the pool may have been archived.
        </p>
        <Link
          href="/"
          className="min-h-tap rounded-pill bg-brand hover:bg-brand-dark mt-5 inline-flex w-full items-center justify-center px-5 font-bold text-white"
        >
          Back to today&apos;s route
        </Link>
      </div>
    </main>
  );
}
