"use client";

import { useActionState } from "react";
import { changeMyPassword, updateMyPhone } from "@/app/actions/profile";
import { Alert, Button, Field, Input } from "@/components/ui";

export function PhoneForm({ phone }: { phone: string }) {
  const [state, action, pending] = useActionState(updateMyPhone, null);
  return (
    <form action={action} className="space-y-3">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.ok ? state.message : state.error}</Alert>}
      <Field label="Mobile number" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Save
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeMyPassword, null);
  return (
    <form action={action} className="space-y-3">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.ok ? state.message : state.error}</Alert>}
      <Field label="Current password" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="password" hint="10+ characters, upper and lower case, and a number">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>
        Change password
      </Button>
    </form>
  );
}
