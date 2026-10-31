import {
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  PlaneTakeoff,
  ScrollText,
  Settings,
  ShieldCheck,
  User,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: Record<Role, NavGroup[]> = {
  super_admin: [
    { items: [{ href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      label: "People",
      items: [
        { href: "/super-admin/admins", label: "Manage Admins", icon: ShieldCheck },
        { href: "/super-admin/employees", label: "Manage Employees", icon: Users },
      ],
    },
    {
      label: "Travel requests",
      items: [
        { href: "/super-admin/requests", label: "All Requests", icon: ClipboardList, exact: true },
        { href: "/super-admin/requests/travelling", label: "Travelling Today", icon: PlaneTakeoff },
        { href: "/super-admin/requests/pending", label: "Pending", icon: Clock },
        { href: "/super-admin/requests/approved", label: "Approved", icon: CheckCircle2 },
        { href: "/super-admin/requests/rejected", label: "Rejected", icon: XCircle },
        { href: "/super-admin/history", label: "Travel History", icon: History },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/super-admin/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/super-admin/reports", label: "Reports", icon: FileText },
        { href: "/super-admin/audit-logs", label: "Audit Logs", icon: ScrollText },
      ],
    },
    { items: [{ href: "/super-admin/settings", label: "Settings", icon: Settings }] },
  ],
  admin: [
    { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    { items: [{ href: "/admin/employees", label: "Assigned Employees", icon: Users }] },
    {
      label: "Requests",
      items: [
        { href: "/admin/requests/new", label: "New Requests", icon: Inbox },
        { href: "/admin/requests/pending", label: "Pending Approvals", icon: Clock },
        { href: "/admin/requests/travelling", label: "Travelling Today", icon: PlaneTakeoff },
        { href: "/admin/requests/approved", label: "Approved", icon: CheckCircle2 },
        { href: "/admin/requests/rejected", label: "Rejected", icon: XCircle },
        { href: "/admin/history", label: "Travel History", icon: History },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/reports", label: "Reports", icon: FileText },
      ],
    },
    { items: [{ href: "/admin/profile", label: "Profile", icon: User }] },
  ],
  employee: [
    {
      items: [
        { href: "/employee", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/employee/new-request", label: "New Travel Request", icon: FilePlus2 },
      ],
    },
    {
      label: "My requests",
      items: [
        { href: "/employee/requests", label: "My Requests", icon: ClipboardList, exact: true },
        { href: "/employee/requests/pending", label: "Pending", icon: Clock },
        { href: "/employee/requests/approved", label: "Approved", icon: CheckCircle2 },
        { href: "/employee/requests/rejected", label: "Rejected", icon: XCircle },
        { href: "/employee/history", label: "Travel History", icon: History },
      ],
    },
    {
      items: [
        { href: "/employee/notifications", label: "Notifications", icon: Bell },
        { href: "/employee/profile", label: "Profile", icon: User },
      ],
    },
  ],
};
