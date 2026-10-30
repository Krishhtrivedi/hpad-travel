import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-bg bg-hpad-blueprint px-4 py-8 sm:py-12 selection:bg-brand selection:text-brand-contrast transition-colors duration-300">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <ThemeToggle />
      </div>

      {/* Architectural decorative watermark in corner */}
      <div className="pointer-events-none absolute top-8 left-8 hidden lg:block opacity-40">
        <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-muted">
          HIREN PATEL ARCHITECTS &amp; DESIGN
        </p>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted/70">
          STUDIO OXYGEN · AHMEDABAD · EST. 1989
        </p>
      </div>

      <div className="w-full max-w-md animate-hpad-enter">
        <div className="mb-6 sm:mb-8 flex flex-col items-center text-center">
          <BrandLogo className="scale-105 sm:scale-110 mb-2" showTagline />
          <p className="mt-2 sm:mt-3 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-muted">
            Flight &amp; Site Visit Travel Management
          </p>
        </div>

        <div className="rounded-brand border border-line bg-surface/95 backdrop-blur-md p-6 sm:p-9 shadow-hover">
          {children}
        </div>

        <div className="mt-6 sm:mt-8 text-center space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/80">
            {BRAND.tagline}
          </p>
          <p className="text-[11px] text-muted/60">
            © {new Date().getFullYear()} {BRAND.studioName}. Authorised personnel only.
          </p>
        </div>
      </div>
    </main>
  );
}
