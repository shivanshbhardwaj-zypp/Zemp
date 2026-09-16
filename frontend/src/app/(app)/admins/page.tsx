import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminsPage } from '@/components/people/AdminsPage';

export const metadata: Metadata = { title: 'Admins' };

export default function Page() {
  return (
    <Suspense>
      <AdminsPage />
    </Suspense>
  );
}
