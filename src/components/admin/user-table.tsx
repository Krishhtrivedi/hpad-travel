"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Power, Search } from "lucide-react";
import { reassignEmployee, sendPasswordReset, setUserActive } from "@/app/actions/users";
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Table, Td, Th } from "@/components/ui";
import { UserFormDialog, type UserFormValues } from "./user-form-dialog";

export interface UserRow {
  id: string;
  full_name: string;
  email: string;
  employee_id: string;
  phone: string | null;
  department: string | null;
  role: "admin" | "employee";
  assigned_admin_id: string | null;
  admin_name: string | null;
  is_active: boolean;
  employees?: number;
  received?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  requests?: number;
}

export function UserTable({
  role,
  rows,
  admins,
  meId,
}: {
  role: "admin" | "employee";
  rows: UserRow[];
  admins: { id: string; label: string }[];
  meId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adminFilter, setAdminFilter] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [editing, setEditing] = useState<UserFormValues | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const label = role === "admin" ? "Admin" : "Employee";

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!s || [r.full_name, r.email, r.employee_id, r.department ?? ""].some((x) => x.toLowerCase().includes(s))) &&
        (!adminFilter || r.assigned_admin_id === adminFilter) &&
        (!status || (status === "active") === r.is_active),
    );
  }, [rows, q, adminFilter, status]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { tone: "success", text: res.message ?? "Done." } : { tone: "danger", text: res.error ?? "Failed." });
      if (res.ok) router.refresh();
    });

  const blank: UserFormValues = {
    full_name: "",
    email: "",
    employee_id: "",
    phone: "",
    department: "",
    role,
    assigned_admin_id: "",
  };

  return (
    <>
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 border-b border-line p-4">
          <div className="relative w-full sm:min-w-[220px] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}s`} className="pl-9" aria-label="Search" />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {role === "employee" && (
              <Select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} className="w-full sm:w-auto" aria-label="Filter by admin">
                <option value="">All admins</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full sm:w-auto" aria-label="Filter by status">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Button onClick={() => setEditing(blank)} disabled={role === "employee" && admins.length === 0} className="col-span-2 sm:col-span-1 justify-center">
              <Plus className="h-4 w-4" /> Add {label.toLowerCase()}
            </Button>
          </div>
        </div>
        {role === "employee" && admins.length === 0 && (
          <div className="p-4">
            <Alert tone="warning">Create at least one active Admin first — every employee must report to an Admin.</Alert>
          </div>
        )}
        {filtered.length === 0 ? (
          <EmptyState title={`No ${label.toLowerCase()}s found`} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{label}</Th>
                <Th>Department</Th>
                {role === "employee" ? <Th>Reporting admin</Th> : <Th>Employees</Th>}
                {role === "employee" ? <Th>Requests</Th> : <Th>Approved / Rejected / Pending</Th>}
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={r.is_active ? "" : "opacity-60"}>
                  <Td>
                    {role === "employee" ? (
                      <Link href={`/super-admin/employees/${r.id}`} className="font-medium text-brand hover:underline">
                        {r.full_name}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.full_name}</span>
                    )}
                    <div className="text-xs text-muted">
                      {r.employee_id} · {r.email}
                    </div>
                  </Td>
                  <Td>{r.department ?? "—"}</Td>
                  <Td>
                    {role === "employee" ? (
                      <Select
                        value={r.assigned_admin_id ?? ""}
                        onChange={(e) => e.target.value && run(() => reassignEmployee(r.id, e.target.value))}
                        disabled={pending}
                        className="h-8 w-44 text-xs"
                        aria-label={`Reporting admin for ${r.full_name}`}
                      >
                        {admins.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      r.employees ?? 0
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {role === "employee" ? (
                      r.requests ?? 0
                    ) : (
                      <span>
                        <span className="text-success">{r.approved ?? 0}</span> / <span className="text-danger">{r.rejected ?? 0}</span> /{" "}
                        <span className="text-warning">{r.pending ?? 0}</span>
                      </span>
                    )}
                  </Td>
                  <Td>{r.is_active ? <Badge className="bg-success-soft text-success">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label="Edit"
                        onClick={() =>
                          setEditing({
                            id: r.id,
                            full_name: r.full_name,
                            email: r.email,
                            employee_id: r.employee_id,
                            phone: r.phone ?? "",
                            department: r.department ?? "",
                            role: r.role,
                            assigned_admin_id: r.assigned_admin_id ?? "",
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="Send password reset email"
                        disabled={pending || !r.is_active}
                        onClick={() => confirm(`Email a password reset link to ${r.email}?`) && run(() => sendPasswordReset(r.id))}
                      >
                        <KeyRound className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label={r.is_active ? "Deactivate" : "Activate"}
                        disabled={pending || r.id === meId}
                        danger={r.is_active}
                        onClick={() =>
                          confirm(r.is_active ? `Deactivate ${r.full_name}? They will be signed out of all data immediately.` : `Reactivate ${r.full_name}?`) &&
                          run(() => setUserActive(r.id, !r.is_active))
                        }
                      >
                        <Power className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <UserFormDialog key={editing.id ?? "new"} open onClose={() => setEditing(null)} initial={editing} admins={admins} />}
    </>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-brand p-2 text-muted hover:bg-surface-muted disabled:opacity-40 ${danger ? "hover:text-danger" : "hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
