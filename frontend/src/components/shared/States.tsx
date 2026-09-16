'use client';

import { CircleAlert, Inbox, LockKeyhole, RotateCw, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Meaningful empty state instead of "No data" (Frontend.md §57). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Page or section failure with a retry, without technical detail (Frontend.md §59). */
export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this. Please try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Shown for areas the current role cannot open (Frontend.md §103). Reveals nothing about the resource. */
export function AccessDenied() {
  return (
    <EmptyState
      icon={LockKeyhole}
      title="Access restricted"
      description="You don't have permission to view this area."
      action={
        <Button asChild variant="secondary">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      }
      className="min-h-[60dvh]"
    />
  );
}
