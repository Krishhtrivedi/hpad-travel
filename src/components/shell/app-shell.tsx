"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, User, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV } from "@/components/shell/nav";
import { NotificationBell } from "@/components/shell/notification-bell";
import { RealtimeRefresher } from "@/components/shell/realtime-refresher";
import { signOut } from "@/app/actions/auth";
import type { Role } from "@/lib/types";
import { cn, homeFor, ROLE_LABEL } from "@/lib/utils";

interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string;
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("hpad.sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("hpad.sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };

  const base = homeFor(user.role);
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const sidebar = (compact: boolean) => (
    <nav className="flex h-full flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-ink)] transition-colors duration-300">
      <div className={cn("flex h-16 items-center border-b border-[var(--sidebar-border)] px-4", compact && "justify-center px-2")}>
        <Link href={base} aria-label="Dashboard" className="flex items-center gap-2">
          <BrandLogo variant="light" className={compact ? "h-6" : "h-7"} />
        </Link>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV[user.role].map((group, gi) => (
          <div key={gi}>
            {group.label && !compact && (
              <p className="mb-2 px-3 text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--sidebar-muted)]">{group.label}</p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={compact ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-brand px-3 py-2.5 text-xs font-mono uppercase tracking-[0.14em] transition-all duration-200",
                        compact && "justify-center px-2",
                        active
                          ? "bg-[var(--sidebar-active)] font-semibold text-white shadow-xs border-l-2 border-white pl-2.5"
                          : "text-[var(--sidebar-ink)]/75 hover:bg-[var(--sidebar-hover)] hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className={cn("border-t border-[var(--sidebar-border)] px-4 py-3 text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--sidebar-muted)] flex items-center justify-between gap-2", compact && "justify-center px-2")}>
        {!compact ? (
          <>
            <span>{ROLE_LABEL[user.role]}</span>
            <ThemeToggle className="h-7 px-2 border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" />
          </>
        ) : (
          <ThemeToggle className="h-8 w-8 p-0 border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" />
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <RealtimeRefresher />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 z-10 rounded p-1 text-white/80 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 transition-all">
          <button
            className="rounded-brand p-2 text-muted hover:bg-surface-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            className="hidden rounded-brand p-2 text-muted hover:bg-surface-muted lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <div className="lg:hidden">
            <BrandLogo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell profileId={user.id} base={base} />
            <UserMenu user={user} base={base} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ user, base }: { user: ShellUser; base: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const profileHref = user.role === "super_admin" ? `${base}/settings` : `${base}/profile`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-brand p-1.5 hover:bg-surface-muted"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[160px] truncate text-sm font-medium text-ink">{user.name}</span>
          <span className="block text-xs text-muted">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 overflow-hidden rounded-brand border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="text-xs text-muted">ID: {user.employeeId}</p>
          </div>
          <div className="border-t border-line py-1">
            <ThemeToggle variant="dropdown-item" />
          </div>
          <Link href={profileHref} className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink hover:bg-surface-muted" onClick={() => setOpen(false)}>
            <User className="h-4 w-4" /> {user.role === "super_admin" ? "Settings" : "My profile"}
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-soft">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
