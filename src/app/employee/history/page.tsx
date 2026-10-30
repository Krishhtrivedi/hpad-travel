import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Travel History" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["employee"]);
  return (
    <RequestsView
      profile={profile}
      title="Travel History"
      description="Your permanent record of travel requests and decisions."
      basePath="/employee/history"
      searchParams={await searchParams}
      variant="history"
    />
  );
}
