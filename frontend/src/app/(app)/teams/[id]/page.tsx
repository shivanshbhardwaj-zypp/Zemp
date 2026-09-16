import type { Metadata } from 'next';
import { TeamDetail } from '@/components/teams/TeamDetail';

export const metadata: Metadata = { title: 'Team' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamDetail id={id} />;
}
