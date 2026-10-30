"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <>
      <h1 className="text-xl font-semibold text-ink">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">At least 10 characters, with upper and lower case letters and a number.</p>
      {state?.ok ? (
        <div className="mt-6 space-y-4">
          <Alert tone="success">{state.message}</Alert>
          <Link href="/" className="block text-center text-sm font-medium text-brand hover:underline">
            Continue to your dashboard
          </Link>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4">
          {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
          <Field label="New password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={pending}>
            Update password
          </Button>
        </form>
      )}
    </>
  );
}
