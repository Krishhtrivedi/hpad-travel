"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  showStatus?: boolean;
  showEmployee?: boolean;
  showAdmin?: boolean;
  employees?: { id: string; label: string }[];
  admins?: { id: string; label: string }[];
}

const KEYS = ["status", "type", "from", "to", "sub_from", "sub_to", "employee", "admin", "dest"] as const;

export function RequestFilters({ showStatus, showEmployee, showAdmin, employees = [], admins = [] }: FilterOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const activeCount = KEYS.filter((k) => params.get(k)).length;
  const [open, setOpen] = useState(activeCount > 0);

  const push = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => push({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => push({ [k]: e.target.value || null });

  return (
    <div className="space-y-3 border-b border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by request ID, employee, destination or purpose"
            className="pl-9"
            aria-label="Search requests"
          />
        </div>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Filter className="h-4 w-4" /> Filters
          {activeCount > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-brand-contrast">{activeCount}</span>}
        </Button>
        {(activeCount > 0 || q) && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              startTransition(() => router.push(pathname, { scroll: false }));
            }}
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
      {open && (
        <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", pending && "opacity-60")}>
          {showStatus && (
            <LabeledControl label="Status">
              <Select value={params.get("status") ?? ""} onChange={set("status")}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
            </LabeledControl>
          )}
          <LabeledControl label="Travel type">
            <Select value={params.get("type") ?? ""} onChange={set("type")}>
              <option value="">All types</option>
              <option value="flight">Flight Travel</option>
              <option value="site_visit">Site Visit</option>
              <option value="other">Other Official Travel</option>
            </Select>
          </LabeledControl>
          <LabeledControl label="Destination">
            <Input defaultValue={params.get("dest") ?? ""} onBlur={set("dest")} placeholder="City" />
          </LabeledControl>
          {showEmployee && (
            <LabeledControl label="Employee">
              <Select value={params.get("employee") ?? ""} onChange={set("employee")}>
                <option value="">All employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </Select>
            </LabeledControl>
          )}
          {showAdmin && (
            <LabeledControl label="Admin">
              <Select value={params.get("admin") ?? ""} onChange={set("admin")}>
                <option value="">All admins</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </LabeledControl>
          )}
          <LabeledControl label="Departure from">
            <Input type="date" value={params.get("from") ?? ""} onChange={set("from")} />
          </LabeledControl>
          <LabeledControl label="Departure to">
            <Input type="date" value={params.get("to") ?? ""} onChange={set("to")} />
          </LabeledControl>
          <LabeledControl label="Submitted from">
            <Input type="date" value={params.get("sub_from") ?? ""} onChange={set("sub_from")} />
          </LabeledControl>
          <LabeledControl label="Submitted to">
            <Input type="date" value={params.get("sub_to") ?? ""} onChange={set("sub_to")} />
          </LabeledControl>
        </div>
      )}
    </div>
  );
}

function LabeledControl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
