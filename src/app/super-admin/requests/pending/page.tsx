import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Pending Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["super_admin"]);
  return (
    <RequestsView
      profile={profile}
      title="Pending Requests"
      description="All pending travel requests."
      basePath="/super-admin/requests/pending"
      searchParams={await searchParams}
      statuses={["pending"]}
    />
  );
}
