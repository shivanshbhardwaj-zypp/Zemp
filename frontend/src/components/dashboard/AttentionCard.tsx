'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { DashboardAttention, DashboardSummary, TaskSummary } from '@zemp/shared';
import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { TaskRow } from '@/components/tasks/TaskRow';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { formatCount } from '@/lib/format';

interface AttentionCardProps {
  title: string;
  attention: UseQueryResult<DashboardAttention>;
  summary?: DashboardSummary;
  showAssignee?: boolean;
  className?: string;
}

/** Overdue, blocked and due-soon work in one place (Frontend.md §136–138). */
export function AttentionCard({ title, attention, summary, showAssignee = true, className }: AttentionCardProps) {
  const data = attention.data;
  const tabs: Array<{ value: string; label: string; count?: number; tasks?: TaskSummary[]; href: string; empty: string }> = [
    {
      value: 'overdue',
      label: 'Overdue',
      count: summary?.workload.overdue,
      tasks: data?.overdue,
      href: '/tasks?deadline=OVERDUE',
      empty: 'Nothing is overdue.',
    },
    {
      value: 'blocked',
      label: 'Blocked',
      count: summary?.workload.blocked,
      tasks: data?.blocked,
      href: '/tasks?status=BLOCKED',
      empty: 'Nothing is blocked.',
    },
    {
      value: 'due-soon',
      label: 'Due soon',
      count: data?.dueSoon.length,
      tasks: data?.dueSoon,
      href: '/tasks?status=TODO,IN_PROGRESS&sort=dueAt&order=asc',
      empty: 'Nothing is due in the next two days.',
    },
  ];

  return (
    <Card className={className}>
      <CardHeader title={title} description="Work that needs a decision or a nudge" />
      <Tabs defaultValue="overdue" className="px-5 pt-3 pb-2">
        <TabsList aria-label="Attention lists">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-surface-muted px-1.5 text-xs font-semibold text-ink-secondary tabular">
                  {formatCount(tab.count)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="outline-none">
            {attention.error ? (
              <ErrorState onRetry={() => attention.refetch()} className="py-6" />
            ) : !tab.tasks ? (
              <div className="grid gap-3 py-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : tab.tasks.length === 0 ? (
              <EmptyState icon={CircleCheck} title={tab.empty} className="py-8" />
            ) : (
              <>
                <ul className="divide-y divide-border-subtle">
                  {tab.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} showAssignee={showAssignee} />
                  ))}
                </ul>
                <Link href={tab.href} className="mt-1 mb-2 inline-block text-meta font-medium text-primary-ink hover:underline">
                  View all {tab.label.toLowerCase()} tasks
                </Link>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
