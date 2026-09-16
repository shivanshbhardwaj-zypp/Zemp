import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReportsPage } from '@/components/reports/ReportsPage';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return (
    <Suspense>
      <ReportsPage variant="reports" />
    </Suspense>
  );
}
