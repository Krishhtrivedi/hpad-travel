import { HpadMarkSvg } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-bg bg-hpad-blueprint px-4 py-10 sm:py-16 selection:bg-brand selection:text-brand-contrast transition-colors duration-300">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Architectural decorative watermark in corner */}
      <div className="pointer-events-none absolute top-8 left-8 hidden lg:block opacity-40 select-none">
        <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-muted">
          HIREN PATEL ARCHITECTS &amp; DESIGN
        </p>
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted/70">
          STUDIO OXYGEN · AHMEDABAD · EST. 1989
        </p>
      </div>

      <div className="w-full max-w-[420px] animate-hpad-enter">
        {/* Optically Centered Architectural Brand Crest */}
        <div className="mb-7 flex flex-col items-center text-center select-none">
          <div className="flex h-11 w-auto items-center justify-center mb-2.5 transition-transform duration-300 hover:scale-[1.04]">
            <HpadMarkSvg className="h-9 w-auto text-[#493D51] dark:text-[#F4F9FD]" />
          </div>
          <span className="font-mono text-sm font-semibold tracking-[0.22em] uppercase text-ink">
            {BRAND.appName}
          </span>
          <p className="mt-1 font-mono text-[10px] tracking-[0.18em] uppercase text-muted">
            {BRAND.studioName}
          </p>
          <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted/70 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted font-medium">
              Travel Management Portal
            </span>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-brand border border-line bg-surface/95 backdrop-blur-md p-6 sm:p-8 shadow-card">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-7 text-center space-y-1.5 select-none">
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
