import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Travel History" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["admin"]);
  return (
    <RequestsView
      profile={profile}
      title="Travel History"
      description="Travel history of your assigned employees."
      basePath="/admin/history"
      searchParams={await searchParams}
      variant="history"
    />
  );
}
