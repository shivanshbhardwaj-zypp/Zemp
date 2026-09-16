'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ApiError } from '@/lib/api/client';

const NO_RETRY_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Dashboards refresh on navigation and after mutations rather than on every tab focus (§168).
        refetchOnWindowFocus: false,
        retry: (failures, error) => !(error instanceof ApiError && NO_RETRY_STATUSES.has(error.status)) && failures < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300} skipDelayDuration={400}>
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: '!rounded-md !border-border-subtle !bg-surface !text-ink !shadow-elevated !font-sans',
              description: '!text-ink-muted',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
