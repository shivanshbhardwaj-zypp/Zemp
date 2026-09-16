'use client';

import type { PasswordResetIssued } from '@zemp/shared';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { useIssuePasswordReset, useSetAccountActive } from '@/hooks/usePeople';
import { ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/session';

interface Account {
  id: string;
  name: string;
  isActive: boolean;
  role: 'ADMIN' | 'EMPLOYEE' | 'SUPER_ADMIN';
}

/** Deactivate / reactivate with the consequence spelled out (Frontend.md §62). */
export function AccountStatusDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const mutation = useSetAccountActive();
  const deactivating = account.isActive;
  const noun = account.role === 'ADMIN' ? 'admin' : 'employee';
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={deactivating ? `Deactivate ${account.name}?` : `Reactivate ${account.name}?`}
      description={
        deactivating
          ? `They will be signed out immediately and can no longer sign in or receive new tasks. Their existing work and history stay in place.`
          : `They will be able to sign in and receive new tasks again.`
      }
      confirmLabel={deactivating ? `Deactivate ${noun}` : `Reactivate ${noun}`}
      destructive={deactivating}
      loading={mutation.isPending}
      onConfirm={() =>
        mutation.mutate(
          { id: account.id, active: !deactivating },
          {
            onSuccess: () => {
              toast.success(deactivating ? `${account.name} deactivated.` : `${account.name} reactivated.`);
              onClose();
            },
            onError: (error) => toast.error(error instanceof ApiError ? error.message : 'The account could not be updated.'),
          },
        )
      }
    />
  );
}

/**
 * Super Admin "reset access": issues a one-time link to hand over directly, because V0.1 has no
 * email service. The link is shown once and never stored in the browser.
 */
export function PasswordResetDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const timeZone = useTimeZone();
  const issue = useIssuePasswordReset();
  const [issued, setIssued] = useState<PasswordResetIssued | null>(null);
  const [copied, setCopied] = useState(false);
  const link = issued ? `${window.location.origin}${issued.resetUrl}` : '';

  if (!issued) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={`Reset access for ${account.name}?`}
        description="A one-time link lets them choose a new password. Any link issued earlier stops being the only way in, and all their sessions end once they use it."
        confirmLabel="Create reset link"
        loading={issue.isPending}
        onConfirm={() =>
          issue.mutate(account.id, {
            onSuccess: setIssued,
            onError: (error) => toast.error(error instanceof ApiError ? error.message : 'A reset link could not be created.'),
          })
        }
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Reset link created"
        description={`Share this link with ${account.name} directly. It works once and expires ${formatDateTime(issued.expiresAt, timeZone)}.`}
      >
        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-subtle p-2">
          <code className="min-w-0 flex-1 truncate px-1.5 text-meta text-ink-secondary">{link}</code>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
