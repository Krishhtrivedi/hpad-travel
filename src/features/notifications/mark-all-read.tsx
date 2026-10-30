"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          await createClient().from("notifications").update({ is_read: true }).eq("is_read", false);
          router.refresh();
        })
      }
    >
      <CheckCheck className="h-4 w-4" /> Mark all as read
    </Button>
  );
}
