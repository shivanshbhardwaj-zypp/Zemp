import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmployeesPage } from '@/components/people/EmployeesPage';

export const metadata: Metadata = { title: 'Employees' };

export default function Page() {
  return (
    <Suspense>
      <EmployeesPage />
    </Suspense>
  );
}
