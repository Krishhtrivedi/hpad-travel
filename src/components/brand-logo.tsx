import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Official HPAD logo vector from hpad.co.in.
 * Supports dynamic Light and Dark mode coloring.
 */
export function HpadMarkSvg({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="775.8838 252.28339 134.482 62.232"
      fill="currentColor"
      className={className}
    >
      <path
        transform="matrix(1,0,0,-1,910.3658,252.28339)"
        d="M0 0V-32.656H-7.706V-29.578C-7.706-23.098-12.978-17.825-19.459-17.825-25.937-17.825-31.21-23.098-31.21-29.578-31.21-36.058-25.937-41.329-19.459-41.329V-49.037C-26.798-49.037-33.2-44.953-36.513-38.938-38.045-36.159-38.917-32.969-38.917-29.578-38.917-23.098-44.188-17.825-50.668-17.825-57.148-17.825-62.421-23.098-62.421-29.578-62.421-36.004-57.236-41.242-50.829-41.327V-49.035C-57.76-48.978-63.838-45.281-67.241-39.764-70.668-45.324-76.817-49.037-83.814-49.037V-41.329C-77.333-41.329-72.061-36.058-72.061-29.578-72.061-23.098-77.333-17.825-83.814-17.825-90.294-17.825-95.564-23.098-95.564-29.578V-62.232H-103.272V-29.578C-103.272-23.098-108.543-17.825-115.023-17.825-121.503-17.825-126.776-23.098-126.776-29.578V-32.656H-134.482V0H-126.776V-14.081C-123.508-11.595-119.435-10.12-115.023-10.12-108.642-10.12-102.969-13.207-99.417-17.965-95.867-13.207-90.195-10.12-83.814-10.12-76.817-10.12-70.668-13.833-67.241-19.392-63.813-13.833-57.665-10.12-50.668-10.12-44.287-10.12-38.614-13.207-35.063-17.965-31.513-13.207-25.84-10.12-19.459-10.12-15.046-10.12-10.974-11.595-7.706-14.081V0Z"
      />
    </svg>
  );
}

export function BrandLogo({
  variant = "default",
  className,
  showTagline = false,
}: {
  variant?: "default" | "light";
  className?: string;
  showTagline?: boolean;
}) {
  const isLight = variant === "light";

  return (
    <div className={cn("inline-flex items-center gap-2.5 sm:gap-3 shrink-0 select-none", className)}>
      <div className="relative flex items-center justify-center transition-transform duration-300 hover:scale-[1.03]">
        <HpadMarkSvg
          className={cn(
            "h-7 w-auto transition-colors duration-300",
            isLight
              ? "text-white"
              : "text-[#493D51] dark:text-[#F4F9FD]"
          )}
        />
      </div>
      <div className="flex flex-col text-left">
        <span
          className={cn(
            "font-mono text-xs font-semibold tracking-[0.2em] uppercase leading-none whitespace-nowrap transition-colors duration-300",
            isLight
              ? "text-white/95"
              : "text-[#2A2230] dark:text-[#F4F9FD]"
          )}
        >
          {BRAND.appName}
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 text-[10px] font-mono tracking-[0.14em] uppercase leading-tight transition-colors duration-300",
              isLight
                ? "text-white/60"
                : "text-muted"
            )}
          >
            {BRAND.studioName}
          </span>
        )}
      </div>
    </div>
  );
}
