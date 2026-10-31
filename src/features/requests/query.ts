import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestStatus, TravelRequest } from "@/lib/types";
import { sanitizeSearch, todayIST } from "@/lib/utils";

export const PAGE_SIZE = 15;

export type RequestFilters = {
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  sub_from?: string;
  sub_to?: string;
  admin?: string;
  employee?: string;
  dest?: string;
  sort?: string;
  dir?: string;
  page?: string;
};

const SORTABLE = new Set([
  "request_number",
  "employee_name",
  "destination_city",
  "travel_type",
  "departure_date",
  "return_date",
  "status",
  "submitted_at",
  "reviewed_at",
]);

export const LIST_COLUMNS =
  "id, request_number, employee_id, employee_name, employee_code, employee_department, assigned_admin_name, travel_type, departure_city, destination_city, destination_state, destination_country, travel_purpose, departure_date, return_date, departure_time, return_time, estimated_expenses, status, submitted_at, reviewed_at, reviewed_by_name, review_comments, created_at";

export type ListRow = Pick<
  TravelRequest,
  | "id"
  | "request_number"
  | "employee_id"
  | "employee_name"
  | "employee_code"
  | "employee_department"
  | "assigned_admin_name"
  | "travel_type"
  | "departure_city"
  | "destination_city"
  | "destination_state"
  | "destination_country"
  | "travel_purpose"
  | "departure_date"
  | "return_date"
  | "departure_time"
  | "return_time"
  | "estimated_expenses"
  | "status"
  | "submitted_at"
  | "reviewed_at"
  | "reviewed_by_name"
  | "review_comments"
  | "created_at"
>;

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isUuid = (s?: string) => !!s && /^[0-9a-f-]{36}$/i.test(s);

/**
 * Builds a filtered, sorted, paginated query on travel_requests.
 * Visibility is enforced by RLS; these filters only narrow it further.
 */
export function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  f: RequestFilters,
  scope: { statuses?: RequestStatus[]; includeDrafts?: boolean; submittedSince?: string; travellingToday?: boolean } = {},
) {
  let q = query;
  const status = f.status as RequestStatus | undefined;

  if (scope.travellingToday) {
    const today = todayIST();
    q = q.eq("status", "approved").lte("departure_date", today).gte("return_date", today);
  } else if (scope.statuses?.length) {
    q = q.in("status", scope.statuses);
  } else if (status && ["draft", "pending", "approved", "rejected"].includes(status)) {
    q = q.eq("status", status);
  } else if (!scope.includeDrafts) {
    q = q.neq("status", "draft");
  }

  if (scope.submittedSince) q = q.gte("submitted_at", scope.submittedSince);

  if (f.type && ["flight", "site_visit", "other"].includes(f.type)) q = q.eq("travel_type", f.type);
  if (isDate(f.from)) q = q.gte("departure_date", f.from);
  if (isDate(f.to)) q = q.lte("departure_date", f.to);
  if (isDate(f.sub_from)) q = q.gte("submitted_at", `${f.sub_from}T00:00:00+05:30`);
  if (isDate(f.sub_to)) q = q.lte("submitted_at", `${f.sub_to}T23:59:59+05:30`);
  if (isUuid(f.admin)) q = q.eq("assigned_admin_id", f.admin);
  if (isUuid(f.employee)) q = q.eq("employee_id", f.employee);
  const dest = sanitizeSearch(f.dest);
  if (dest) q = q.ilike("destination_city", `%${dest}%`);
  const search = sanitizeSearch(f.q);
  if (search) {
    q = q.or(
      [
        `request_number.ilike.%${search}%`,
        `employee_name.ilike.%${search}%`,
        `employee_code.ilike.%${search}%`,
        `destination_city.ilike.%${search}%`,
        `travel_purpose.ilike.%${search}%`,
      ].join(","),
    );
  }
  return q;
}

export async function fetchRequests(
  supabase: SupabaseClient,
  f: RequestFilters,
  scope: { statuses?: RequestStatus[]; includeDrafts?: boolean; submittedSince?: string; defaultSort?: string; travellingToday?: boolean } = {},
) {
  const page = Math.max(1, Number(f.page) || 1);
  const sort = f.sort && SORTABLE.has(f.sort) ? f.sort : scope.defaultSort ?? "submitted_at";
  const ascending = f.dir === "asc";

  let query = supabase.from("travel_requests").select(LIST_COLUMNS, { count: "exact" });
  query = applyFilters(query, f, scope);
  query = query
    .order(sort, { ascending, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, count, error } = await query;
  return {
    rows: (data as ListRow[] | null) ?? [],
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    sort,
    dir: ascending ? "asc" : "desc",
    error: error?.message,
  };
}
