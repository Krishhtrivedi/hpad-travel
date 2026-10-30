import * as React from "react";
import Link from "next/link";
import { cn, STATUS_LABEL } from "@/lib/utils";
import type { RequestStatus } from "@/lib/types";

/* ---------------------------------------------------------------- Button */
type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost" | "line";
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-brand text-xs font-mono uppercase tracking-[0.14em] font-medium transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-contrast hover:bg-brand-hover shadow-sm hover:shadow border border-brand/20",
  secondary:
    "bg-surface text-ink border border-line hover:border-brand/40 hover:bg-brand-soft/30 shadow-xs",
  line:
    "bg-transparent text-ink border border-line hover:border-ink hover:bg-brand-soft/20",
  danger:
    "bg-danger text-white hover:opacity-90 shadow-xs",
  success:
    "bg-success text-white hover:opacity-90 shadow-xs",
  ghost:
    "text-ink hover:bg-brand-soft/40 hover:text-brand",
};

const buttonSizes = {
  sm: "h-9 sm:h-8 px-3.5 text-xs sm:text-[11px] min-h-[36px] sm:min-h-0",
  md: "h-11 sm:h-10 px-4 text-xs min-h-[44px] sm:min-h-0",
  lg: "h-12 sm:h-11 px-5 sm:px-6 text-xs min-h-[48px] sm:min-h-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: keyof typeof buttonSizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

/* ---------------------------------------------------------------- Card */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-brand border border-line bg-surface shadow-card transition-all duration-300 card-hover max-w-full overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4.5", className)}>
      <div>
        <h2 className="text-sm sm:text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-6", className)} {...props} />;
}

/* ---------------------------------------------------------------- Page header */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3.5 sm:gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-light tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 sm:mt-1.5 text-xs font-mono uppercase tracking-[0.14em] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Stat card */
export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  hint?: string;
  href?: string;
}) {
  const tones = {
    brand: "bg-brand-soft/70 text-brand border-brand/10",
    success: "bg-success-soft/70 text-success border-success/10",
    warning: "bg-warning-soft/70 text-warning border-warning/10",
    danger: "bg-danger-soft/70 text-danger border-danger/10",
    info: "bg-info-soft/70 text-info border-info/10",
  };
  const body = (
    <Card className={cn("flex items-center gap-3.5 sm:gap-4.5 p-4 sm:p-5 group", href && "hover:border-brand/40")}>
      {icon && (
        <div className={cn("flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-brand border transition-transform duration-300 group-hover:scale-105", tones[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-mono uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-0.5 text-xl sm:text-2xl font-normal tracking-tight tabular-nums text-ink">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-muted">{hint}</p>}
      </div>
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/* ---------------------------------------------------------------- Badge */
const statusConfig: Record<RequestStatus, { bg: string; dot: string }> = {
  draft: { bg: "bg-surface-muted text-muted border-line", dot: "bg-muted" },
  pending: { bg: "bg-warning-soft text-warning border-warning/20", dot: "bg-warning animate-pulse" },
  approved: { bg: "bg-success-soft text-success border-success/20", dot: "bg-success" },
  rejected: { bg: "bg-danger-soft text-danger border-danger/20", dot: "bg-danger" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] font-medium",
        cfg.bg
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.14em] text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Form controls */
const control =
  "w-full rounded-brand border border-line bg-surface px-3.5 text-base sm:text-sm text-ink placeholder:text-muted/60 transition-all duration-200 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/10 disabled:bg-surface-muted disabled:text-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, "h-10.5", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(control, "h-10.5 pr-8", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-[96px] py-2.5", className)} {...props} />;
  },
);

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-mono uppercase tracking-[0.14em] text-ink font-medium">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink font-medium">{value || "—"}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- Alerts / empty */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-info-soft text-brand border-brand/20",
    success: "bg-success-soft text-success border-success/20",
    warning: "bg-warning-soft text-warning border-warning/20",
    danger: "bg-danger-soft text-danger border-danger/20",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-brand border px-4 py-3 text-sm", tones[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="h-10 w-10 rounded-full bg-brand-soft/50 flex items-center justify-center mb-3 text-brand">
        <span className="font-mono text-sm tracking-widest font-semibold">HP</span>
      </div>
      <p className="font-medium text-ink tracking-tight">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Table */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-full overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] sm:min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line bg-surface-muted/60 px-5 py-3 text-left text-[11px] font-mono uppercase tracking-[0.16em] text-muted font-medium",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "border-b border-line px-5 py-3.5 align-middle text-ink transition-colors hover:bg-brand-soft/10",
        className
      )}
    >
      {children}
    </td>
  );
}