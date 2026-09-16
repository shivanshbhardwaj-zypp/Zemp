'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';
import { overlayClasses } from './Dialog';

export const Sheet = DialogPrimitive.Root;
export const SheetClose = DialogPrimitive.Close;

const SIDES = {
  right:
    'inset-y-0 right-0 h-full w-full sm:max-w-[520px] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
  left: 'inset-y-0 left-0 h-full w-[284px] max-w-[85vw] data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
  bottom:
    'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
};

interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  side?: keyof typeof SIDES;
  title: string;
  description?: string;
  /** Visually hide the header, e.g. for the navigation drawer. */
  hideHeader?: boolean;
}

/** Side sheet for quick inspection and navigation (Frontend.md §61, §165). */
export function SheetContent({ side = 'right', title, description, hideHeader, className, children, ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClasses} />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col bg-surface shadow-modal ease-drawer',
          'data-[state=open]:animate-in data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:duration-200',
          SIDES[side],
          className,
        )}
        {...props}
      >
        <div className={cn('flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4', hideHeader && 'sr-only')}>
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={description ? 'mt-0.5 text-meta text-ink-muted' : 'sr-only'}>
              {description ?? title}
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close
            aria-label="Close"
            className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
