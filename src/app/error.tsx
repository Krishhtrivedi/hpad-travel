"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        The page could not be loaded. If this keeps happening, contact the Super Admin{error.digest ? ` with reference ${error.digest}` : ""}.
      </p>
      <button onClick={reset} className="mt-6 rounded-brand bg-brand px-4 py-2 text-sm font-medium text-brand-contrast hover:bg-brand-hover">
        Try again
      </button>
    </main>
  );
}
