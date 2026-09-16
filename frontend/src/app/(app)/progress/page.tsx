import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReportsPage } from '@/components/reports/ReportsPage';

export const metadata: Metadata = { title: 'My Progress' };

export default function Page() {
  return (
    <Suspense>
      <ReportsPage variant="self" />
    </Suspense>
  );
}
