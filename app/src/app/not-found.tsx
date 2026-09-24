import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-12">
      <div className="rounded-card bg-card p-6 text-center shadow-sm ring-1 ring-line">
        <h1 className="text-xl">Page not found</h1>
        <p className="mt-2 text-sm text-ink-soft">
          That link may be out of date, or the pool may have been archived.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-tap w-full items-center justify-center rounded-pill bg-brand px-5 font-bold text-white hover:bg-brand-dark"
        >
          Back to today&apos;s route
        </Link>
      </div>
    </main>
  );
}
