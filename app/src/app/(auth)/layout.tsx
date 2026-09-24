import Image from "next/image";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 py-10">
      <div className="mb-7 flex items-center gap-3">
        <Image src="/favicon.png" alt="" width={44} height={44} className="rounded-sm" priority />
        <div>
          <p className="text-2xl font-extrabold tracking-tight">Fludd</p>
          <p className="text-sm text-ink-soft leading-snug">Pool service</p>
        </div>
      </div>
      {children}
    </main>
  );
}
