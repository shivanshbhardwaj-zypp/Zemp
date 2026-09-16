'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { passwordResetConfirmSchema, passwordResetRequestSchema, type PasswordResetConfirmInput, type PasswordResetRequestInput } from '@zemp/shared';
import { CircleAlert, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

function Alert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

/** Always shows the same confirmation, so it never reveals whether an account exists. */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.input<typeof passwordResetRequestSchema>, unknown, PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: '' },
  });

  if (sent) {
    return (
      <div className="mt-8 grid gap-5">
        <div className="flex gap-3 rounded-md bg-success-soft px-4 py-3.5 text-sm text-success-ink">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>If an active account uses that email, a password reset link is on its way. Your administrator can also issue one directly.</p>
        </div>
        <Button asChild variant="secondary" size="lg">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="mt-8 grid gap-5"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          await authApi.requestPasswordReset(values);
          setSent(true);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        }
      })}
    >
      <Field label="Work email" error={formState.errors.email?.message}>
        {(c) => <Input {...c} {...register('email')} type="email" autoComplete="email" autoFocus />}
      </Field>
      <Alert message={error} />
      <Button type="submit" size="lg" loading={formState.isSubmitting} className="w-full">
        Send reset link
      </Button>
      <Link href="/login" className="text-center text-meta font-medium text-primary-ink hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<PasswordResetConfirmInput>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { token, newPassword: '' },
  });

  if (!token) {
    return (
      <div className="mt-8 grid gap-5">
        <Alert message="This reset link is incomplete. Ask your administrator for a new one." />
        <Button asChild variant="secondary" size="lg">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-8 grid gap-5">
        <p className="rounded-md bg-success-soft px-4 py-3.5 text-sm text-success-ink">Your password was changed. Sign in with your new password.</p>
        <Button asChild size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="mt-8 grid gap-5"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          await authApi.confirmPasswordReset(values);
          setDone(true);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        }
      })}
    >
      <input type="hidden" {...register('token')} />
      <Field label="New password" hint="At least 10 characters with a letter and a number." error={formState.errors.newPassword?.message}>
        {(c) => <Input {...c} {...register('newPassword')} type="password" autoComplete="new-password" autoFocus />}
      </Field>
      <Alert message={error ?? formState.errors.token?.message ?? null} />
      <Button type="submit" size="lg" loading={formState.isSubmitting} className="w-full">
        Set new password
      </Button>
    </form>
  );
}
