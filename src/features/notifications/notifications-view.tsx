import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MarkAllRead } from "./mark-all-read";
import { createClient } from "@/lib/supabase/server";
import type { Notification, Profile } from "@/lib/types";
import { cn, formatDateTime, homeFor } from "@/lib/utils";

export async function NotificationsView({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const items = (data as Notification[]) ?? [];
  const unread = items.filter((n) => !n.is_read).length;
  const base = homeFor(profile.role);

  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread`} actions={unread > 0 ? <MarkAllRead /> : undefined} />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="No notifications yet" description="Updates about travel requests will appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const body = (
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-3 p-4 sm:px-5 sm:py-4">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-accent")} aria-label={n.is_read ? undefined : "Unread"} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm text-ink", !n.is_read && "font-semibold")}>{n.title}</p>
                      <p className="mt-0.5 text-xs sm:text-sm text-muted break-words">{n.message}</p>
                    </div>
                  </div>
                  <time className="shrink-0 text-[11px] sm:text-xs text-muted pl-4.5 sm:pl-0 font-mono">{formatDateTime(n.created_at)}</time>
                </div>
              );
              return (
                <li key={n.id} className={cn(!n.is_read && "bg-brand-soft/40")}>
                  {n.travel_request_id ? (
                    <Link href={`${base}/requests/${n.travel_request_id}`} className="block hover:bg-surface-muted">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
