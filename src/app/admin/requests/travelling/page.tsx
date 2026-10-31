import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Travelling Today" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["admin"]);
  return (
    <RequestsView
      profile={profile}
      title="Travelling Today"
      description="Assigned employees who are on approved official travel outside Ahmedabad today."
      basePath="/admin/requests/travelling"
      searchParams={await searchParams}
      travellingToday
    />
  );
}
