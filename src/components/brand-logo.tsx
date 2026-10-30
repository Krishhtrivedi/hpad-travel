/* eslint-disable @next/next/no-img-element */
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Official HPAD logo vector from hpad.co.in.
 */
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
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className={cn("relative flex items-center justify-center transition-transform duration-300 hover:scale-[1.03]")}>
        <img
          src="/brand/hpad-mark.svg"
          alt={BRAND.name}
          className={cn(
            "h-7 w-auto object-contain transition-all duration-300",
            isLight ? "text-white brightness-0 invert" : "text-[#493D51]"
          )}
        />
      </div>
      <div className="flex flex-col text-left">
        <span
          className={cn(
            "font-mono text-xs font-semibold tracking-[0.2em] uppercase leading-none",
            isLight ? "text-white/95" : "text-[#2A2230]"
          )}
        >
          {BRAND.appName}
        </span>
        {showTagline && (
          <span
            className={cn(
              "mt-1 text-[10px] font-mono tracking-[0.14em] uppercase text-muted leading-tight",
              isLight ? "text-white/60" : "text-[#787570]"
            )}
          >
            {BRAND.studioName}
          </span>
        )}
      </div>
    </div>
  );
}
