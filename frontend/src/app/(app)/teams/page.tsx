import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TeamsPage } from '@/components/teams/TeamsPage';

export const metadata: Metadata = { title: 'Teams' };

export default function Page() {
  return (
    <Suspense>
      <TeamsPage />
    </Suspense>
  );
}
