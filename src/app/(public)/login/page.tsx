import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  inactive: "Your account is not active or has no profile. Please contact the Super Admin.",
  link: "That link is invalid or has expired. Please request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in to your account</h1>
        <p className="mt-1 text-xs text-muted">Use your company email and password to continue.</p>
      </div>
      <LoginForm next={next} initialError={error ? ERRORS[error] : undefined} />
    </>
  );
}
