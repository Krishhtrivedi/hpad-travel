"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export function NotificationBell({ profileId, base }: { profileId: string; base: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
    ]);
    setItems((data as Notification[]) ?? []);
    setUnread(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${profileId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profileId, load]);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markRead = async (id?: string) => {
    let q = supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    if (id) q = q.eq("id", id);
    await q;
    load();
  };

  const notificationsPage = base === "/employee" ? "/employee/notifications" : `${base}/notifications`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-brand p-2 text-muted hover:bg-surface-muted hover:text-ink"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3.5 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] z-50 overflow-hidden rounded-brand border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button onClick={() => markRead()} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</li>}
            {items.map((n) => (
              <li key={n.id} className={cn(!n.is_read && "bg-brand-soft/50")}>
                <Link
                  href={n.travel_request_id ? `${base}/requests/${n.travel_request_id}` : notificationsPage}
                  onClick={() => {
                    setOpen(false);
                    if (!n.is_read) markRead(n.id);
                  }}
                  className="block px-4 py-3 hover:bg-surface-muted"
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.message}</p>
                      <p className="mt-1 text-xs text-muted">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link href={notificationsPage} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-brand hover:bg-surface-muted">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
