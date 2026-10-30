import Link from "next/link";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th, Alert } from "@/components/ui";
import { Pagination, SortHeader } from "@/components/requests/pagination";
import { RequestFilters } from "@/components/requests/request-filters";
import { createClient } from "@/lib/supabase/server";
import type { Profile, RequestStatus } from "@/lib/types";
import { formatDate, homeFor, TRAVEL_TYPE_LABEL } from "@/lib/utils";
import { fetchRequests, PAGE_SIZE, type RequestFilters as Filters } from "./query";

export interface RequestsViewProps {
  profile: Profile;
  title: string;
  description?: string;
  basePath: string;
  searchParams: Filters;
  statuses?: RequestStatus[];
  includeDrafts?: boolean;
  submittedSince?: string;
  /** "history" uses the travel-history column set from the spec */
  variant?: "list" | "history";
  actions?: React.ReactNode;
  emptyAction?: React.ReactNode;
}

export async function RequestsView({
  profile,
  title,
  description,
  basePath,
  searchParams,
  statuses,
  includeDrafts,
  submittedSince,
  variant = "list",
  actions,
  emptyAction,
}: RequestsViewProps) {
  const supabase = await createClient();
  const result = await fetchRequests(supabase, searchParams, {
    statuses,
    includeDrafts,
    submittedSince,
    defaultSort: variant === "history" ? "departure_date" : "submitted_at",
  });

  const isEmployee = profile.role === "employee";
  const isSuper = profile.role === "super_admin";

  // Filter dropdown options (RLS limits these to what the user may see)
  let employees: { id: string; label: string }[] = [];
  let admins: { id: string; label: string }[] = [];
  if (!isEmployee) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, employee_id, role")
      .in("role", isSuper ? ["employee", "admin"] : ["employee"])
      .order("full_name");
    employees = (data ?? []).filter((p) => p.role === "employee").map((p) => ({ id: p.id, label: `${p.full_name} (${p.employee_id})` }));
    admins = (data ?? []).filter((p) => p.role === "admin").map((p) => ({ id: p.id, label: p.full_name }));
  }

  const showStatus = !statuses || statuses.length !== 1;
  const params = searchParams as Record<string, string | undefined>;
  const detailBase = `${homeFor(profile.role)}/requests`;
  const sortProps = { sort: result.sort, dir: result.dir, basePath, params };

  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      <Card>
        <Suspense>
          <RequestFilters showStatus={showStatus} showEmployee={!isEmployee} showAdmin={isSuper} employees={employees} admins={admins} />
        </Suspense>
        {result.error && (
          <div className="p-4">
            <Alert tone="danger">Could not load requests: {result.error}</Alert>
          </div>
        )}
        {result.rows.length === 0 ? (
          <EmptyState
            title="No travel requests found"
            description={Object.keys(params).length ? "Try clearing some filters." : "Requests will appear here once they are submitted."}
            action={emptyAction}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>
                  <SortHeader label="Request ID" column="request_number" {...sortProps} />
                </Th>
                {!isEmployee && (
                  <Th>
                    <SortHeader label="Employee" column="employee_name" {...sortProps} />
                  </Th>
                )}
                <Th>
                  <SortHeader label="Destination" column="destination_city" {...sortProps} />
                </Th>
                <Th>
                  <SortHeader label="Travel type" column="travel_type" {...sortProps} />
                </Th>
                <Th>
                  <SortHeader label="Departure" column="departure_date" {...sortProps} />
                </Th>
                <Th>
                  <SortHeader label="Return" column="return_date" {...sortProps} />
                </Th>
                {variant === "list" && (
                  <Th>
                    <SortHeader label="Submitted" column="submitted_at" {...sortProps} />
                  </Th>
                )}
                <Th>
                  <SortHeader label="Status" column="status" {...sortProps} />
                </Th>
                <Th>{variant === "history" ? "Approved / reviewed by" : isEmployee ? "Reporting admin" : "Admin"}</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const href = r.status === "draft" ? `/employee/requests/${r.id}/edit` : `${detailBase}/${r.id}`;
                return (
                  <tr key={r.id} className="hover:bg-surface-muted/60">
                    <Td>
                      <Link href={href} className="font-medium text-brand hover:underline">
                        {r.request_number ?? "Draft"}
                      </Link>
                    </Td>
                    {!isEmployee && (
                      <Td>
                        <div className="font-medium">{r.employee_name}</div>
                        <div className="text-xs text-muted">{r.employee_code}</div>
                      </Td>
                    )}
                    <Td>
                      <div>{r.destination_city ?? "—"}</div>
                      {r.destination_state && <div className="text-xs text-muted">{r.destination_state}</div>}
                    </Td>
                    <Td>{TRAVEL_TYPE_LABEL[r.travel_type]}</Td>
                    <Td className="whitespace-nowrap">{formatDate(r.departure_date)}</Td>
                    <Td className="whitespace-nowrap">{formatDate(r.return_date)}</Td>
                    {variant === "list" && <Td className="whitespace-nowrap">{formatDate(r.submitted_at)}</Td>}
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td className="text-muted">
                      {variant === "history"
                        ? r.status === "pending"
                          ? "Awaiting decision"
                          : r.reviewed_by_name ?? "—"
                        : r.status === "pending" || r.status === "draft"
                          ? r.assigned_admin_name ?? "—"
                          : r.reviewed_by_name ?? r.assigned_admin_name ?? "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={PAGE_SIZE} basePath={basePath} params={params} />
      </Card>
    </>
  );
}
