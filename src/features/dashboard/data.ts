import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/lib/types";
import { todayIST } from "@/lib/utils";
import { LIST_COLUMNS, type ListRow } from "@/features/requests/query";

const EMPTY: DashboardStats = {
  total_employees: 0,
  active_employees: 0,
  total_admins: 0,
  total_requests: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  currently_travelling: 0,
  upcoming: 0,
  monthly: [],
  yearly: [],
  by_type: [],
  top_destinations: [],
  employee_frequency: [],
  admin_performance: [],
};

/** All figures come from the database, filtered by the caller's RLS. */
export async function getDashboardData() {
  const supabase = await createClient();
  const today = todayIST();
  const [stats, recent, current, upcoming] = await Promise.all([
    supabase.rpc("get_dashboard_stats"),
    supabase.from("travel_requests").select(LIST_COLUMNS).neq("status", "draft").order("submitted_at", { ascending: false }).limit(6),
    supabase
      .from("travel_requests")
      .select(LIST_COLUMNS)
      .eq("status", "approved")
      .lte("departure_date", today)
      .gte("return_date", today)
      .order("return_date")
      .limit(8),
    supabase.from("travel_requests").select(LIST_COLUMNS).eq("status", "approved").gt("departure_date", today).order("departure_date").limit(8),
  ]);
  return {
    stats: { ...EMPTY, ...((stats.data as DashboardStats | null) ?? {}) },
    error: stats.error?.message,
    recent: (recent.data as ListRow[] | null) ?? [],
    current: (current.data as ListRow[] | null) ?? [],
    upcoming: (upcoming.data as ListRow[] | null) ?? [],
  };
}
