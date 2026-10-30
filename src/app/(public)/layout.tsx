import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/brand";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-bg bg-hpad-blueprint px-4 py-12 selection:bg-brand selection:text-brand-contrast">
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
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="scale-110 mb-2" showTagline />
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Flight &amp; Site Visit Travel Management
          </p>
        </div>

        <div className="rounded-brand border border-line bg-surface/95 backdrop-blur-md p-7 shadow-hover sm:p-9">
          {children}
        </div>

        <div className="mt-8 text-center space-y-1">
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
