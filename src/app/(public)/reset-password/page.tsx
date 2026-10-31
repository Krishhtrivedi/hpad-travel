"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { updatePassword } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Choose a new password</h1>
        <p className="mt-1 text-xs text-muted">At least 6 characters, with letters and numbers.</p>
      </div>

      {state?.ok ? (
        <div className="space-y-4">
          <Alert tone="success">{state.message}</Alert>
          <Link href="/login" className="block text-center text-xs font-mono uppercase tracking-[0.14em] font-medium text-brand hover:underline">
            Continue to sign in →
          </Link>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
          <Field label="New password" htmlFor="password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
              <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••" required autoFocus className="pl-10" />
            </div>
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" placeholder="••••••••" required className="pl-10" />
            </div>
          </Field>
          <Button type="submit" className="w-full justify-center shadow-xs hover:shadow transition-all" size="lg" loading={pending}>
            Update password
          </Button>
          <div className="pt-2 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.14em] text-muted hover:text-ink transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
