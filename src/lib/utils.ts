import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RequestStatus, Role, TravelType } from "@/lib/types";
import { BRAND } from "@/lib/brand";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TRAVEL_TYPE_LABEL: Record<TravelType, string> = {
  flight: "Flight Travel",
  site_visit: "Site Visit",
  other: "Other Official Travel",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  employee: "Employee",
};

export function homeFor(role: Role) {
  return role === "super_admin" ? "/super-admin" : role === "admin" ? "/admin" : "/employee";
}

/** Today's date (YYYY-MM-DD) in India time. */
export function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BRAND.timeZone }).format(new Date());
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(value + "T00:00:00") : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(value.length === 10 ? {} : { timeZone: BRAND.timeZone }),
  }).format(d);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRAND.timeZone,
  }).format(d);
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

export function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number(value),
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(value: string) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return formatDate(value);
}

/** Turns database errors into messages a person can act on. */
export function friendlyError(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("travel_requests_dates_order")) return "Return date must be on or after the departure date.";
  if (message.includes("profiles_email_lower_key")) return "An account with this email already exists.";
  if (message.includes("profiles_employee_id_key")) return "That Employee ID is already in use.";
  if (message.includes("documents_file_type")) return "Only PDF, JPG and PNG files are allowed.";
  if (message.includes("documents_file_size")) return "Files must be 10 MB or smaller.";
  if (message.includes("profiles_phone_check")) return "Enter a valid phone number.";
  if (message.includes("invalid input syntax")) return "One of the values entered is not in a valid format.";
  if (message.includes("JWT") || message.includes("session")) return "Your session has expired. Please sign in again.";
  return message;
}

/** Strip characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(q: string | undefined | null) {
  return (q ?? "").replace(/[,()%*\\:"']/g, " ").trim().slice(0, 80);
}
