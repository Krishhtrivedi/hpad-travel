"use client";

import { useState, useTransition } from "react";
import { BellRing } from "lucide-react";
import { sendPendingReminders } from "@/app/actions/users";
import { Alert, Button } from "@/components/ui";

export function ReminderButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await sendPendingReminders();
            setMsg(res.ok ? { ok: true, text: res.message ?? "Done." } : { ok: false, text: res.error });
          })
        }
      >
        <BellRing className="h-4 w-4" /> Send reminders now
      </Button>
    </div>
  );
}
