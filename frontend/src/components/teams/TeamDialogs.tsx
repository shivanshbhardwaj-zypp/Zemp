'use client';

import type { TeamDetail } from '@zemp/shared';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAdmins, useEmployees } from '@/hooks/usePeople';
import { useAddTeamMember, useCreateTeam, useUpdateTeam } from '@/hooks/useTeams';
import { ApiError } from '@/lib/api/client';

function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

/** Create or edit a team, its admin and whether it is active (Super Admin). */
export function TeamFormDialog({ team, onClose }: { team?: TeamDetail; onClose: () => void }) {
  const admins = useAdmins({ status: 'active', page: 1, pageSize: 100 });
  const create = useCreateTeam();
  const update = useUpdateTeam(team?.id ?? '');
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [ownerId, setOwnerId] = useState(team?.owner?.id ?? '');
  const [isActive, setIsActive] = useState(team?.isActive ?? true);
  const [errors, setErrors] = useState<{ name?: string; ownerId?: string; form?: string }>({});
  const pending = create.isPending || update.isPending;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setErrors({ name: 'Team name needs at least 2 characters' });
      return;
    }
    setErrors({});
    try {
      if (team) {
        await update.mutateAsync({
          name: name.trim() !== team.name ? name.trim() : undefined,
          description: description.trim() !== (team.description ?? '') ? description.trim() || null : undefined,
          ownerId: ownerId !== (team.owner?.id ?? '') ? ownerId || null : undefined,
          isActive: isActive !== team.isActive ? isActive : undefined,
        });
        toast.success('Team updated.');
      } else {
        await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, ownerId: ownerId || null });
        toast.success(`Team ${name.trim()} created.`);
      }
      onClose();
    } catch (error) {
      if (!(error instanceof ApiError)) return setErrors({ form: 'Something went wrong. Please try again.' });
      const fields = error.details?.fieldErrors ?? {};
      setErrors({ name: fields.name?.[0], ownerId: fields.ownerId?.[0], form: fields.name || fields.ownerId ? undefined : error.message });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={team ? `Edit ${team.name}` : 'Create Team'} description="Teams group employees under the admin who manages their work.">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field label="Team name" error={errors.name}>
            {(c) => <Input {...c} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />}
          </Field>
          <Field label="Description" hint="Optional">
            {(c) => <Textarea {...c} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />}
          </Field>
          <Field label="Admin" hint="The admin who manages this team's work" error={errors.ownerId}>
            {(c) => (
              <Select {...c} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">No admin yet</option>
                {(admins.data?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {team && (
            <label className="flex items-start gap-3 rounded-md border border-border-subtle px-3.5 py-3 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="mt-0.5 size-4 accent-primary-strong" />
              <span>
                <span className="font-medium text-ink">Team is active</span>
                <span className="block text-meta text-ink-muted">A team can only be deactivated once its active members have moved.</span>
              </span>
            </label>
          )}
          <FormAlert message={errors.form} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {team ? 'Save changes' : 'Create Team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Move an employee into this team; their history stays with them (Frontend.md §118). */
export function AddMemberDialog({ team, memberIds, onClose }: { team: TeamDetail; memberIds: string[]; onClose: () => void }) {
  const employees = useEmployees({ status: 'active', page: 1, pageSize: 100 });
  const add = useAddTeamMember(team.id);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string>();
  const options = (employees.data?.items ?? []).filter((e) => !memberIds.includes(e.id));
  const chosen = options.find((e) => e.id === userId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosen) return setError('Choose an employee');
    try {
      await add.mutateAsync({ userId: chosen.id });
      toast.success(`${chosen.name} moved to ${team.name}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The employee could not be moved.');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={`Add a member to ${team.name}`} description="Moving an employee changes their team and admin. Their tasks and history are kept.">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Employee" error={error}>
            {(c) => (
              <Select {...c} value={userId} onChange={(e) => setUserId(e.target.value)} disabled={employees.isPending}>
                <option value="">{employees.isPending ? 'Loading employees…' : 'Choose an employee'}</option>
                {options.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — currently {e.team?.name ?? 'no team'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={add.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending}>
              Move to team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
