import { RequestDetailView } from "@/features/requests/request-detail-view";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Travel Request" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(["employee"]);
  const { id } = await params;
  return <RequestDetailView profile={profile} id={id} backHref="/employee/requests" />;
}
