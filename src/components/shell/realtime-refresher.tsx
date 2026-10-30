"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for database changes the user is allowed to see (Realtime applies
 * RLS) and re-renders the current page from the server, so dashboards,
 * statistics and lists update without a manual refresh.
 */
export function RealtimeRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel("live-travel-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "travel_requests" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "approval_history" }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
