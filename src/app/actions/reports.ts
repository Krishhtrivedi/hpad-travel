"use server";

import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export type ReportType = "employee" | "monthly" | "approvals" | "rejections" | "admin_performance" | "history";

const schema = z.object({
  type: z.enum(["employee", "monthly", "approvals", "rejections", "admin_performance", "history"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
  employee: z.uuid().optional().or(z.literal("")),
});

export interface ReportRow {
  request_number: string | null;
  employee_name: string;
  employee_code: string;
  employee_department: string | null;
  travel_type: string;
  departure_city: string;
  destination_city: string | null;
  destination_state: string | null;
  travel_purpose: string | null;
  departure_date: string | null;
  return_date: string | null;
  estimated_expenses: number | null;
  status: string;
  submitted_at: string | null;
  assigned_admin_name: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
}

const COLS =
  "request_number, employee_name, employee_code, employee_department, travel_type, departure_city, destination_city, destination_state, travel_purpose, departure_date, return_date, estimated_expenses, status, submitted_at, assigned_admin_name, reviewed_by_name, reviewed_at, review_comments";

/** Report data is read as the signed-in user, so RLS limits it to what they may see. */
export async function fetchReportData(input: z.infer<typeof schema>): Promise<ActionResult<{ rows: ReportRow[]; truncated: boolean }>> {
  try {
    await assertRole(["admin", "super_admin"]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the report options." };
  const f = parsed.data;
  const LIMIT = 5000;

  const supabase = await createClient();
  let q = supabase.from("travel_requests").select(COLS).neq("status", "draft");

  if (f.type === "monthly") {
    if (!f.month) return { ok: false, error: "Choose a month." };
    const [y, m] = f.month.split("-").map(Number);
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    q = q.gte("departure_date", `${f.month}-01`).lte("departure_date", end);
  } else if (f.type === "approvals" || f.type === "rejections") {
    q = q.eq("status", f.type === "approvals" ? "approved" : "rejected");
    if (f.from) q = q.gte("reviewed_at", `${f.from}T00:00:00+05:30`);
    if (f.to) q = q.lte("reviewed_at", `${f.to}T23:59:59+05:30`);
  } else {
    if (f.from) q = q.gte("departure_date", f.from);
    if (f.to) q = q.lte("departure_date", f.to);
  }
  if (f.type === "employee") {
    if (!f.employee) return { ok: false, error: "Choose an employee." };
    q = q.eq("employee_id", f.employee);
  }

  const { data, error } = await q.order("departure_date", { ascending: false }).limit(LIMIT + 1);
  if (error) return { ok: false, error: error.message };
  const rows = (data as ReportRow[]) ?? [];
  return { ok: true, data: { rows: rows.slice(0, LIMIT), truncated: rows.length > LIMIT } };
}
