import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import type { UserRow } from "@/components/admin/user-table";

type Stats = { profile_id: string; employees: number; requests: number; received: number; pending: number; approved: number; rejected: number };

/** People + live request counts, read under the caller's RLS. */
export async function getPeople(role: "admin" | "employee") {
  const supabase = await createClient();
  const [{ data: people }, { data: admins }, { data: stats }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", role).order("full_name"),
    supabase.from("profiles").select("id, full_name, employee_id, is_active").eq("role", "admin").order("full_name"),
    supabase.rpc("get_people_stats"),
  ]);
  const byId = new Map(((stats as Stats[]) ?? []).map((s) => [s.profile_id, s]));
  const adminName = new Map((admins ?? []).map((a) => [a.id, a.full_name]));
  const rows: UserRow[] = ((people as Profile[]) ?? []).map((p) => {
    const s = byId.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      employee_id: p.employee_id,
      phone: p.phone,
      department: p.department,
      role: p.role as "admin" | "employee",
      assigned_admin_id: p.assigned_admin_id,
      admin_name: p.assigned_admin_id ? adminName.get(p.assigned_admin_id) ?? null : null,
      is_active: p.is_active,
      employees: Number(s?.employees ?? 0),
      requests: Number(s?.requests ?? 0),
      received: Number(s?.received ?? 0),
      pending: Number(s?.pending ?? 0),
      approved: Number(s?.approved ?? 0),
      rejected: Number(s?.rejected ?? 0),
    };
  });
  const adminOptions = (admins ?? [])
    .filter((a) => a.is_active)
    .map((a) => ({ id: a.id, label: `${a.full_name} (${a.employee_id})` }));
  return { rows, adminOptions };
}
