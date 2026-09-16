import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-9 text-meta',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Initials avatar — no photo required (Frontend.md §56). Decorative: the name is always shown nearby. */
export function UserAvatar({ name, size = 'md', className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-ink select-none',
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
