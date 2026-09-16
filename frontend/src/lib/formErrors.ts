import type { ErrorCode } from '@zemp/shared';
import { useEffect } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api/client';

/**
 * Maps an API failure onto form fields (Frontend.md §148). Field-level problems land on the field;
 * anything else comes back as a form-level message to show above the actions.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  codeFields: Partial<Record<ErrorCode, Path<T>>> = {},
): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  let applied = false;
  for (const [field, messages] of Object.entries(error.details?.fieldErrors ?? {})) {
    const target = fields.find((f) => f === field);
    if (target && messages[0]) {
      setError(target, { message: messages[0] });
      applied = true;
    }
  }
  const codeField = codeFields[error.code];
  if (codeField && !applied) {
    setError(codeField, { message: error.message });
    return null;
  }
  return applied ? null : error.message;
}

/** Warns before the tab closes while a form has unsaved changes (Frontend.md §187). */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
