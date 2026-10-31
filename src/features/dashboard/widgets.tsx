import Link from "next/link";
import { Calendar, ChevronRight, MapPin } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import type { ListRow } from "@/features/requests/query";
import { formatDate, TRAVEL_TYPE_LABEL } from "@/lib/utils";

/** Compact list used for recent requests, current travel and upcoming travel. */
export function RequestMiniList({
  title,
  description,
  rows,
  detailBase,
  showEmployee = true,
  mode = "recent",
  viewAllHref,
  emptyText,
}: {
  title: string;
  description?: string;
  rows: ListRow[];
  detailBase: string;
  showEmployee?: boolean;
  mode?: "recent" | "current" | "upcoming";
  viewAllHref?: string;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs font-mono uppercase tracking-[0.14em] font-medium text-brand hover:underline"
            >
              View all
            </Link>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const dateText =
              mode === "current"
                ? `Returns ${formatDate(r.return_date)}`
                : mode === "upcoming"
                  ? `Departs ${formatDate(r.departure_date)}`
                  : `${formatDate(r.departure_date)} – ${formatDate(r.return_date)}`;

            return (
              <li key={r.id}>
                <Link
                  href={`${detailBase}/${r.id}`}
                  className="group block p-4 sm:px-5 sm:py-3.5 hover:bg-surface-muted transition-colors active:bg-brand-soft/20"
                >
                  {/* Top line: Request Number / Employee & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-semibold text-brand tracking-wider">
                        {r.request_number}
                      </span>
                      {showEmployee && (
                        <span className="truncate text-xs font-medium text-ink/80">
                          · {r.employee_name}
                        </span>
                      )}
                    </div>
                    {mode === "recent" ? (
                      <div className="shrink-0">
                        <StatusBadge status={r.status} />
                      </div>
                    ) : (
                      <Badge className="shrink-0 text-[10px]">
                        {TRAVEL_TYPE_LABEL[r.travel_type]}
                      </Badge>
                    )}
                  </div>

                  {/* Middle line: Destination */}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-ink min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                      <span className="truncate">{r.destination_city || "Destination"}</span>
                      {r.destination_state && (
                        <span className="text-xs text-muted font-normal truncate">
                          ({r.destination_state})
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted/40 shrink-0 group-hover:text-brand transition-colors" />
                  </div>

                  {/* Bottom line: Dates & Travel Type */}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted border-t border-line/40 pt-2">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted">
                      <Calendar className="h-3 w-3 shrink-0 text-muted/70" />
                      {dateText}
                    </span>
                    {mode === "recent" && (
                      <span className="text-[11px] font-mono text-muted/80">
                        {TRAVEL_TYPE_LABEL[r.travel_type]}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
