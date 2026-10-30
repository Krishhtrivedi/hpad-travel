"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { registerDocuments } from "@/app/actions/requests";
import { Alert, Button } from "@/components/ui";
import { uploadDocuments } from "@/lib/upload";
import { validateFile } from "@/lib/validation";

/** Lets an employee attach more files (e.g. a ticket booked later) while a request is pending. */
export function AddDocuments({ requestId, isFlight }: { requestId: string; isFlight: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<"flight_ticket" | "supporting">(isFlight ? "flight_ticket" : "supporting");
  const [msg, setMsg] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const upload = () =>
    start(async () => {
      setMsg(null);
      try {
        const docs = await uploadDocuments(requestId, files.map((file) => ({ file, kind })));
        const res = await registerDocuments(requestId, docs);
        if (!res.ok) throw new Error(res.error);
        setFiles([]);
        setMsg({ tone: "success", text: "Documents uploaded." });
        router.refresh();
      } catch (e) {
        setMsg({ tone: "danger", text: (e as Error).message });
      }
    });

  return (
    <div className="no-print space-y-3 rounded-brand border border-dashed border-line p-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        {isFlight && (
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 rounded-brand border border-line bg-surface px-2 text-sm">
            <option value="flight_ticket">Flight ticket</option>
            <option value="supporting">Supporting document</option>
          </select>
        )}
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            const bad = list.map(validateFile).find(Boolean);
            if (bad) {
              setMsg({ tone: "danger", text: bad });
              e.target.value = "";
              return;
            }
            setFiles(list);
          }}
          className="text-sm file:mr-3 file:rounded-brand file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
        />
        <Button size="sm" onClick={upload} disabled={!files.length} loading={pending}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </div>
      <p className="text-xs text-muted">PDF, JPG or PNG · up to 10 MB each</p>
    </div>
  );
}
