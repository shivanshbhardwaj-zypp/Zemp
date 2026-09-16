'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** Rendered after the label, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}

/** Label → control → helper/error, wired for screen readers (Frontend.md §51). */
export function Field({ label, error, hint, labelAction, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {labelAction}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
      })}
      {message && (
        <p id={messageId} className={cn('text-meta', error ? 'text-danger-ink' : 'text-ink-muted')}>
          {message}
        </p>
      )}
    </div>
  );
}
