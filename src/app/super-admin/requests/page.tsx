import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "All Travel Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["super_admin"]);
  return (
    <RequestsView
      profile={profile}
      title="All Travel Requests"
      description="Every submitted request across the company."
      basePath="/super-admin/requests"
      searchParams={await searchParams}
    />
  );
}
