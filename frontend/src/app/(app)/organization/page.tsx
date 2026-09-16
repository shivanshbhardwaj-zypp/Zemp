import type { Metadata } from 'next';
import { OrganizationChart } from '@/components/people/OrganizationChart';

export const metadata: Metadata = { title: 'Organization' };

export default function Page() {
  return <OrganizationChart />;
}
