import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Shown only while Supabase environment variables are missing. */
export default function SetupPage() {
  if (isSupabaseConfigured) redirect("/login");
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">Database not connected</h1>
      <p className="mt-2 text-sm text-muted">
        The app needs a Supabase project before anyone can sign in. Add these to <code>.env.local</code> (or your Vercel
        project settings) and restart:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-brand bg-surface-muted p-3 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=`}
      </pre>
      <p className="mt-3 text-sm text-muted">See README.md → “Setup” for the full steps.</p>
    </>
  );
}
