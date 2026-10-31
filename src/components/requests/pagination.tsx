import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-8 items-center gap-1 rounded-brand border border-line px-3 text-sm";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-muted border-t border-line">
      <p className="text-center sm:text-left">
        Showing <span className="font-medium text-ink">{from}</span>–<span className="font-medium text-ink">{to}</span> of{" "}
        <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={cn(btn, "hover:bg-surface-muted text-ink")} href={href(page - 1)}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </span>
        )}
        <span className="text-xs font-mono px-1">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link className={cn(btn, "hover:bg-surface-muted text-ink")} href={href(page + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}>
            Next <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

export function SortHeader({
  label,
  column,
  sort,
  dir,
  basePath,
  params,
}: {
  label: string;
  column: string;
  sort: string;
  dir: string;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const active = sort === column;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v && !["page", "sort", "dir"].includes(k)) sp.set(k, v);
  sp.set("sort", column);
  sp.set("dir", active && dir === "desc" ? "asc" : "desc");
  return (
    <Link href={`${basePath}?${sp.toString()}`} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
      {label}
      <span aria-hidden className="text-[10px]">
        {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </Link>
  );
}
