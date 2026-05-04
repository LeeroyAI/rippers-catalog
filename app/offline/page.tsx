import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--background)] px-6 py-12 md:px-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--r-border)] bg-[var(--r-bg-well)] p-8 text-center shadow-sm">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">You are offline</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--r-muted)]">
          Check your connection. If you installed Rippers as an app, pages will load again when you are back online.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--r-orange)] px-5 py-2.5 text-[14px] font-semibold text-white no-underline shadow-[0_6px_20px_rgba(229,71,26,0.3)]"
        >
          Try Home
        </Link>
      </section>
    </main>
  );
}
