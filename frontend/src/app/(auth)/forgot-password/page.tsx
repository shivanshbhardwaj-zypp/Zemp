import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/PasswordResetForms';

export const metadata: Metadata = { title: 'Forgot password' };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Enter your work email and we&apos;ll send a reset link.</p>
      <ForgotPasswordForm />
    </>
  );
}
