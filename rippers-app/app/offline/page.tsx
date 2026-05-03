export default function OfflinePage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-zinc-50 px-6 md:px-10 xl:px-14 dark:bg-black">
      <section className="w-full max-w-none rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          You are offline
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Please check your connection and try again. Installed PWA pages will
          load automatically once you are back online.
        </p>
      </section>
    </main>
  );
}
