import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Rejected Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["employee"]);
  return (
    <RequestsView
      profile={profile}
      title="Rejected Requests"
      description="Your rejected travel requests."
      basePath="/employee/requests/rejected"
      searchParams={await searchParams}
      statuses={["rejected"]}
    />
  );
}
