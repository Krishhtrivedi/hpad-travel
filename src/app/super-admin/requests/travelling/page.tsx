import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Travelling Today" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["super_admin"]);
  return (
    <RequestsView
      profile={profile}
      title="Travelling Today"
      description="All employees across the company who are on approved official travel outside Ahmedabad today."
      basePath="/super-admin/requests/travelling"
      searchParams={await searchParams}
      travellingToday
    />
  );
}
