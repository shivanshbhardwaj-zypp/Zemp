'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { z } from 'zod';

export type ParamUpdates = Record<string, string | number | readonly string[] | null | undefined>;

/**
 * Filter, sort and pagination state lives in the URL (Frontend.md §100, §188): it survives refresh,
 * back/forward and can be shared. Changing a filter returns to page 1.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (updates: ParamUpdates, options: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        const text = Array.isArray(value) ? value.join(',') : value;
        if (text === null || text === undefined || text === '') next.delete(key);
        else next.set(key, String(text));
      }
      if ((options.resetPage ?? true) && !('page' in updates)) next.delete('page');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [searchParams, update] as const;
}

/** Parses URL params with a shared schema, dropping invalid values instead of failing the page. */
export function parseSearchParams<T extends z.ZodType>(schema: T, params: URLSearchParams): z.output<T> {
  const raw: Record<string, string> = Object.fromEntries(params);
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    const invalid = result.error.issues.map((issue) => String(issue.path[0] ?? '')).filter((key) => key in raw);
    if (invalid.length === 0) break;
    for (const key of invalid) delete raw[key];
  }
  return schema.parse({});
}
