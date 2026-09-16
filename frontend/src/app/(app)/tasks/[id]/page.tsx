import type { Metadata } from 'next';
import { TaskDetailPage } from '@/components/tasks/TaskDetailPanel';

export const metadata: Metadata = { title: 'Task' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaskDetailPage taskId={id} />;
}
