'use client';

import { SquareArrowOutUpRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetContent } from '@/components/ui/Sheet';
import { TaskDetailPanel } from './TaskDetailPanel';

/** Quick inspection without leaving the list (Frontend.md §165). */
export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent title="Task details" description="Quick view">
        {taskId && (
          <>
            <div className="flex justify-end px-6 pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/tasks/${taskId}`}>
                  <SquareArrowOutUpRight />
                  Open full page
                </Link>
              </Button>
            </div>
            <TaskDetailPanel taskId={taskId} variant="sheet" />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
