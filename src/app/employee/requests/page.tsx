import { RequestsView } from "@/features/requests/requests-view";
import type { RequestFilters } from "@/features/requests/query";
import { requireRole } from "@/lib/auth";
import { ButtonLink } from "@/components/ui";

export const metadata = { title: "My Requests" };

export default async function Page({ searchParams }: { searchParams: Promise<RequestFilters> }) {
  const profile = await requireRole(["employee"]);
  return (
    <RequestsView
      profile={profile}
      title="My Requests"
      description="All your travel requests, including drafts."
      basePath="/employee/requests"
      searchParams={await searchParams}
      includeDrafts
      actions={<ButtonLink href="/employee/new-request">New travel request</ButtonLink>}
      emptyAction={<ButtonLink href="/employee/new-request">Create your first request</ButtonLink>}
    />
  );
}
