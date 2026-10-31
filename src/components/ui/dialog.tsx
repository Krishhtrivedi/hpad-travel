"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible modal built on the native <dialog> element. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        "m-auto w-[min(560px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-brand border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      {open && (
        <div className="w-full">
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
            <div className="min-w-0 pr-2">
              <h2 className="text-base font-semibold leading-tight">{title}</h2>
              {description && <p className="mt-1 text-xs sm:text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 -mr-1 -mt-1 rounded-brand p-1.5 text-muted hover:bg-surface-muted hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
