import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuditLogPage } from '@/components/audit/AuditLogPage';

export const metadata: Metadata = { title: 'Audit Log' };

export default function Page() {
  return (
    <Suspense>
      <AuditLogPage />
    </Suspense>
  );
}
