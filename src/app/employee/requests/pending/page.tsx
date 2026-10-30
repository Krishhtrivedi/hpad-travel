import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Pending Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["employee"]);
  return (
    <RequestsView
      profile={profile}
      title="Pending Requests"
      description="Your pending travel requests."
      basePath="/employee/requests/pending"
      searchParams={await searchParams}
      statuses={["pending"]}
    />
  );
}
