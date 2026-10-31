"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const [show, setShow] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const error = state && !state.ok ? state.error : initialError;

  const fill = (email: string) => {
    setEmailValue(email);
    setPasswordValue("Hpa@123");
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  };

  return (
    <form action={action} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />

      {/* Email field */}
      <Field label="Email address" htmlFor="email">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            ref={emailInputRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@hpad.com"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            required
            autoFocus
            className="pl-10"
          />
        </div>
      </Field>

      {/* Password field */}
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            required
            className="pl-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink transition-colors focus:outline-none"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {/* Auth subline & Forgot password */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted/80">HPAD Security</span>
        <Link
          href="/forgot-password"
          className="font-mono text-xs text-brand hover:text-brand-hover hover:underline transition-colors"
        >
          Forgot password?
        </Link>
      </div>

      {/* Sign in button */}
      <Button type="submit" className="w-full justify-center shadow-xs hover:shadow transition-all mt-1" size="lg" loading={pending}>
        Sign in
      </Button>

      {/* 1-Tap Demo Credentials Helper */}
      <div className="mt-5 border-t border-line/60 pt-4">
        <div className="flex items-center justify-between text-muted mb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold">Demo Quick Fill</span>
          <span className="font-mono text-[10px] text-muted/70">pw: Hpa@123</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => fill("karan@hpad.com")}
            className="rounded border border-line bg-surface-muted/60 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-ink/80 hover:border-brand/40 hover:bg-brand-soft/30 hover:text-ink transition-colors"
          >
            Super Admin
          </button>
          <button
            type="button"
            onClick={() => fill("arjun@hpad.com")}
            className="rounded border border-line bg-surface-muted/60 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-ink/80 hover:border-brand/40 hover:bg-brand-soft/30 hover:text-ink transition-colors"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => fill("aarav@hpad.com")}
            className="rounded border border-line bg-surface-muted/60 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-ink/80 hover:border-brand/40 hover:bg-brand-soft/30 hover:text-ink transition-colors"
          >
            Employee
          </button>
        </div>
      </div>
    </form>
  );
}
