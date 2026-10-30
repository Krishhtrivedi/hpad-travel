import Link from "next/link";
import { Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
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
            <Link href={viewAllHref} className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={emptyText} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`${detailBase}/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {showEmployee ? r.employee_name : r.request_number} <span className="font-normal text-muted">→ {r.destination_city}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {showEmployee && `${r.request_number} · `}
                    {TRAVEL_TYPE_LABEL[r.travel_type]} ·{" "}
                    {mode === "current"
                      ? `returns ${formatDate(r.return_date)}`
                      : mode === "upcoming"
                        ? `departs ${formatDate(r.departure_date)}`
                        : `${formatDate(r.departure_date)} – ${formatDate(r.return_date)}`}
                  </p>
                </div>
                {mode === "recent" && <StatusBadge status={r.status} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
