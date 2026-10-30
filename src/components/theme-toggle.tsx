"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  showLabel = false,
  variant = "button",
}: {
  className?: string;
  showLabel?: boolean;
  variant?: "button" | "dropdown-item";
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("hpad-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("hpad-theme", "light");
    }
  };

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-brand border border-line bg-surface/50 opacity-0",
          className
        )}
      />
    );
  }

  const isDark = theme === "dark";

  if (variant === "dropdown-item") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          "flex w-full items-center justify-between px-4 py-2.5 text-xs font-mono uppercase tracking-[0.14em] text-ink hover:bg-surface-muted transition-colors",
          className
        )}
      >
        <span className="flex items-center gap-2.5">
          {isDark ? (
            <Sun className="h-4 w-4 text-warning" />
          ) : (
            <Moon className="h-4 w-4 text-brand" />
          )}
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </span>
        <span className="text-[10px] text-muted font-normal lowercase tracking-normal">
          {theme}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative flex h-9.5 items-center justify-center gap-2 rounded-brand border border-line bg-surface px-2.5 text-muted shadow-xs transition-all duration-300 hover:border-brand/40 hover:bg-brand-soft/30 hover:text-ink active:scale-95",
        showLabel && "px-3.5",
        className
      )}
    >
      <div className="relative h-4.5 w-4.5 flex items-center justify-center">
        {/* Sun Icon */}
        <Sun
          className={cn(
            "h-4 w-4 transition-all duration-300",
            isDark
              ? "rotate-0 scale-100 text-warning"
              : "-rotate-90 scale-0 opacity-0 absolute text-ink"
          )}
        />
        {/* Moon Icon */}
        <Moon
          className={cn(
            "h-4 w-4 transition-all duration-300",
            !isDark
              ? "rotate-0 scale-100 text-[#493D51]"
              : "rotate-90 scale-0 opacity-0 absolute text-ink"
          )}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-mono uppercase tracking-[0.16em] font-medium text-ink">
          {isDark ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}
