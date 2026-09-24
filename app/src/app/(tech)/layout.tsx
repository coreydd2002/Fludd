import Image from "next/image";
import Link from "next/link";

import { requireTech } from "@/lib/auth";

import { logout } from "../(auth)/actions";

/**
 * Shell for every signed-in screen. requireTech() here is what sends a user who
 * has an account but no company yet to /onboarding — that check needs a
 * database round trip, so it lives here rather than in the proxy where it would
 * run against every request.
 */
export default async function TechLayout({ children }: LayoutProps<"/">) {
  const { tech, company } = await requireTech();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-ground/85 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="Fludd home" width={32} height={32} className="rounded-sm" />
            <span className="font-extrabold tracking-tight">Fludd</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/settings"
              className="rounded-pill px-3 py-2 text-sm font-bold text-ink-soft hover:bg-brand-tint"
            >
              Settings
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-pill px-3 py-2 text-sm font-bold text-ink-soft hover:bg-brand-tint"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[560px] flex-1 px-5 py-6 pad-safe-bottom">
        {children}
      </div>

      <footer className="mx-auto w-full max-w-[560px] px-5 pb-6 text-xs text-ink-faint">
        Signed in as {tech.display_name} · {company.business_name}
      </footer>
    </div>
  );
}
