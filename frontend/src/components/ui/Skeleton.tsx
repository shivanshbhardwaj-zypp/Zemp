import { cn } from '@/lib/cn';

/** Gentle placeholder that keeps final layout dimensions (Frontend.md §58). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-sm bg-surface-muted', className)} />;
}
