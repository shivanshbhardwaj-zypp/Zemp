'use client';

import type { TaskSummary } from '@zemp/shared';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { useAssignableUsers, useReassignTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/api/client';
import { useUser } from '@/lib/session';

/** Reassignment waits for server confirmation — never optimistic (Frontend.md §99). */
export function ReassignDialog({ task, onClose }: { task: TaskSummary; onClose: () => void }) {
  const user = useUser();
  const people = useAssignableUsers({});
  const reassign = useReassignTask(task.id);
  const [assigneeId, setAssigneeId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<string>();

  const options = (people.data ?? []).filter((p) => p.id !== task.assignee.id);
  const chosen = options.find((p) => p.id === assigneeId);
  const needsTeam = chosen?.role === 'ADMIN' && chosen.ownedTeams.length > 1;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosen) {
      setError('Choose who should take over this task');
      return;
    }
    setError(undefined);
    try {
      await reassign.mutateAsync({ assigneeId: chosen.id, teamId: needsTeam && teamId ? teamId : undefined });
      toast.success(`Task reassigned to ${chosen.name}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'This task could not be reassigned. Please try again.');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title="Reassign task"
        description={
          user.role === 'SUPER_ADMIN'
            ? 'Both people are notified and the change is recorded.'
            : `Reassign within ${user.ownedTeams.map((t) => t.name).join(', ')}. Both people are notified.`
        }
      >
        <form onSubmit={submit} className="grid gap-4">
          <div className="rounded-md bg-surface-subtle px-3.5 py-3 text-sm">
            <p className="truncate font-medium text-ink">{task.title}</p>
            <p className="mt-0.5 text-meta text-ink-muted">Currently assigned to {task.assignee.name}</p>
          </div>
          <Field label="New assignee" error={error}>
            {(control) => (
              <Select {...control} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} disabled={people.isPending}>
                <option value="">{people.isPending ? 'Loading people…' : 'Choose a person'}</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.role === 'ADMIN' ? ' (Admin)' : p.team ? ` — ${p.team.name}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {needsTeam && (
            <Field label="Team">
              {(control) => (
                <Select {...control} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">{chosen.ownedTeams[0]!.name} (default)</option>
                  {chosen.ownedTeams.slice(1).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {reassign.isError && !error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger-ink">
              <CircleAlert className="size-4" aria-hidden /> This task could not be reassigned.
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={reassign.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={reassign.isPending}>
              Reassign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
