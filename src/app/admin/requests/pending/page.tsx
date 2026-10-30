import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Pending Approvals" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["admin"]);
  return (
    <RequestsView
      profile={profile}
      title="Pending Approvals"
      description="Requests from your employees waiting for your decision."
      basePath="/admin/requests/pending"
      searchParams={await searchParams}
      statuses={["pending"]}
    />
  );
}
