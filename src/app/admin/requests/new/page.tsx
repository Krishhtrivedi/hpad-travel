import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "New Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["admin"]);
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  return (
    <RequestsView
      profile={profile}
      title="New Requests"
      description="Pending requests submitted in the last 3 days."
      basePath="/admin/requests/new"
      searchParams={await searchParams}
      statuses={["pending"]}
      submittedSince={since}
    />
  );
}
