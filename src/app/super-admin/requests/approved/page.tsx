import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Approved Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["super_admin"]);
  return (
    <RequestsView
      profile={profile}
      title="Approved Requests"
      description="All approved travel requests."
      basePath="/super-admin/requests/approved"
      searchParams={await searchParams}
      statuses={["approved"]}
    />
  );
}
