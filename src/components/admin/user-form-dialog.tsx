"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUser } from "@/app/actions/users";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";

export interface UserFormValues {
  id?: string;
  full_name: string;
  email: string;
  employee_id: string;
  phone: string;
  department: string;
  role: "admin" | "employee";
  assigned_admin_id: string;
}

export function UserFormDialog({
  open,
  onClose,
  initial,
  admins,
}: {
  open: boolean;
  onClose: () => void;
  initial: UserFormValues;
  admins: { id: string; label: string }[];
}) {
  const router = useRouter();
  const editing = !!initial.id;
  const [values, setValues] = useState({ ...initial, password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    start(async () => {
      const res = editing ? await updateUser(initial.id!, values) : await createUser(values);
      if (!res.ok) {
        setError(res.error);
        setErrors(res.fieldErrors ?? {});
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const label = values.role === "admin" ? "Admin" : "Employee";

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} title={editing ? `Edit ${initial.full_name}` : `Add ${label.toLowerCase()}`}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
        <Field label="Full name" htmlFor="u-name" required error={errors.full_name} className="sm:col-span-2">
          <Input id="u-name" value={values.full_name} onChange={set("full_name")} autoFocus />
        </Field>
        <Field label="Email address" htmlFor="u-email" required error={errors.email}>
          <Input id="u-email" type="email" value={values.email} onChange={set("email")} />
        </Field>
        <Field label={`${label} ID`} htmlFor="u-eid" required error={errors.employee_id}>
          <Input id="u-eid" value={values.employee_id} onChange={set("employee_id")} placeholder="e.g. HPAD-014" />
        </Field>
        <Field label="Phone" htmlFor="u-phone" error={errors.phone}>
          <Input id="u-phone" type="tel" value={values.phone} onChange={set("phone")} />
        </Field>
        <Field label="Department" htmlFor="u-dept" error={errors.department}>
          <Input id="u-dept" value={values.department} onChange={set("department")} />
        </Field>
        {values.role === "employee" && (
          <Field label="Reporting admin" htmlFor="u-admin" required error={errors.assigned_admin_id} className="sm:col-span-2">
            <Select id="u-admin" value={values.assigned_admin_id} onChange={set("assigned_admin_id")}>
              <option value="">Choose an admin…</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!editing && (
          <Field
            label="Temporary password"
            htmlFor="u-pw"
            required
            error={errors.password}
            hint="10+ characters with upper and lower case and a number. Share it securely; the user can change it with Forgot password."
            className="sm:col-span-2"
          >
            <Input id="u-pw" type="text" autoComplete="new-password" value={values.password} onChange={set("password")} />
          </Field>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {editing ? "Save changes" : `Create ${label.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
