import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IncentivesPage } from '@/components/incentives/IncentivesPage';

export const metadata: Metadata = { title: 'Incentives' };

export default function Page() {
  return (
    <Suspense>
      <IncentivesPage />
    </Suspense>
  );
}
