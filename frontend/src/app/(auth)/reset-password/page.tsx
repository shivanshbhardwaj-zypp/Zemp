import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/PasswordResetForms';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-ink-muted">This link works once. Other sessions are signed out afterwards.</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
