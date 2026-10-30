"use client";

import { useState } from "react";
import { FileText, ImageIcon, Loader2 } from "lucide-react";
import { getDocumentUrl } from "@/app/actions/requests";
import type { DocumentRow } from "@/lib/types";
import { formatBytes, formatDateTime } from "@/lib/utils";

export function DocumentList({ documents }: { documents: DocumentRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (id: string) => {
    setBusy(id);
    setError(null);
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
    const win = window.open("", "_blank");
    const res = await getDocumentUrl(id);
    setBusy(null);
    if (res.ok && res.data) {
      if (win) win.location.href = res.data.url;
      else window.location.href = res.data.url;
    } else {
      win?.close();
      setError(res.ok ? "Could not open the document." : res.error);
    }
  };

  if (!documents.length) return <p className="text-sm text-muted">No documents uploaded.</p>;

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="divide-y divide-line rounded-brand border border-line">
        {documents.map((d) => (
          <li key={d.id}>
            <button onClick={() => open(d.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted">
              {d.file_type === "application/pdf" ? <FileText className="h-5 w-5 text-danger" /> : <ImageIcon className="h-5 w-5 text-info" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-brand">{d.file_name}</span>
                <span className="block text-xs text-muted">
                  {d.document_kind === "flight_ticket" ? "Flight ticket" : "Supporting document"} · {formatBytes(d.file_size)} ·{" "}
                  {formatDateTime(d.uploaded_at)}
                </span>
              </span>
              {busy === d.id && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
