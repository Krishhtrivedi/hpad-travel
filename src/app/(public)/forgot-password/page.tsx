"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Reset your password</h1>
        <p className="mt-1 text-xs text-muted">We&apos;ll email you a secure link to choose a new password.</p>
      </div>

      <form action={action} className="space-y-4">
        {state && (state.ok ? <Alert tone="success">{state.message}</Alert> : <Alert tone="danger">{state.error}</Alert>)}
        <Field label="Email address" htmlFor="email">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="name@hpad.com" required autoFocus className="pl-10" />
          </div>
        </Field>
        <Button type="submit" className="w-full justify-center shadow-xs hover:shadow transition-all" size="lg" loading={pending}>
          Send reset link
        </Button>
        <div className="pt-2 text-center">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.14em] text-muted hover:text-ink transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>
      </form>
    </>
  );
}
