'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api/auth';
import { ApiError, onUnauthorized } from '@/lib/api/client';
import { sessionQueryKey, useUser } from '@/lib/session';

/**
 * Re-authenticate in place when the session expires, so open forms and filters are not lost
 * (Frontend.md §186).
 */
export function SessionExpiredDialog() {
  const user = useUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => onUnauthorized(() => setOpen(true)), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const session = await authApi.login({ email: user.email, password });
      queryClient.setQueryData(sessionQueryKey, session);
      setOpen(false);
      setPassword('');
      await queryClient.invalidateQueries();
      toast.success('Signed in again.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        title="Your session has expired"
        description="Please sign in again. Anything you were working on is still here."
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <form onSubmit={submit} className="grid gap-4">
          <p className="text-sm text-ink-secondary">
            Signed in as <span className="font-medium text-ink">{user.email}</span>
          </p>
          <Field label="Password" error={error}>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            )}
          </Field>
          <DialogFooter>
            <Button asChild variant="ghost">
              <Link href="/login">Use another account</Link>
            </Button>
            <Button type="submit" loading={pending} disabled={!password}>
              Sign in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
