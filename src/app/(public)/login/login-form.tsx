"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const [show, setShow] = useState(false);
  const error = state && !state.ok ? state.error : initialError;

  return (
    <form action={action} className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />

      {/* Email / User ID field */}
      <Field label="Email or Employee ID" htmlFor="email">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
          <Input
            id="email"
            name="email"
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            placeholder="name@hpad.com or HPAD-001"
            required
            autoFocus
            className="pl-10 touch-manipulation"
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
            required
            className="pl-10 pr-10 touch-manipulation"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink transition-colors focus:outline-none touch-manipulation"
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
      <Button
        type="submit"
        className="w-full justify-center shadow-xs hover:shadow transition-all mt-1 touch-manipulation"
        size="lg"
        loading={pending}
      >
        Sign in
      </Button>
    </form>
  );
}
