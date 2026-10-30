import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted">This page doesn&apos;t exist, or you don&apos;t have permission to see it.</p>
      <Link href="/" className="mt-6 text-sm font-medium text-brand hover:underline">
        Go to your dashboard
      </Link>
    </main>
  );
}
