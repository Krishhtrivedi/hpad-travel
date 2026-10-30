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
      <h1 className="text-xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Use your company email and password.</p>
      <LoginForm next={next} initialError={error ? ERRORS[error] : undefined} />
    </>
  );
}
