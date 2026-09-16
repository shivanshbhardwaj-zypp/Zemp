'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAdminSchema,
  createEmployeeSchema,
  type AdminListItem,
  type EmployeeDetail,
  type UpdateAdminInput,
  type UpdateEmployeeInput,
} from '@zemp/shared';
import { CircleAlert, Eye, EyeOff, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useCreateAdmin, useCreateEmployee, useUpdateAdmin, useUpdateEmployee } from '@/hooks/usePeople';
import { useTeamOptions } from '@/hooks/useTeams';
import { applyApiError, useLeaveGuard } from '@/lib/formErrors';

/** A strong temporary password the Super Admin can hand over; the API still enforces the policy. */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#%*+-';
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${body}7a`;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-meta font-semibold tracking-wide text-ink-muted uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function PasswordField<T extends FieldValues>({
  register,
  name,
  error,
  onGenerate,
}: {
  register: UseFormRegister<T>;
  name: Path<T>;
  error?: string;
  onGenerate: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label="Temporary password" hint="At least 10 characters with a letter and a number. Share it securely." error={error}>
      {(control) => (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input {...control} {...register(name)} type={visible ? 'text' : 'password'} autoComplete="new-password" className="pr-11" />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-faint hover:text-ink"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              onGenerate();
              setVisible(true);
            }}
          >
            <WandSparkles />
            Generate
          </Button>
        </div>
      )}
    </Field>
  );
}

const employeeFormSchema = createEmployeeSchema;
type EmployeeFormInput = z.input<typeof employeeFormSchema>;
type EmployeeFormOutput = z.output<typeof employeeFormSchema>;

/** Add Employee: basic information → team → role → manager → access (Frontend.md §82). */
export function EmployeeFormDialog({ employee, onClose }: { employee?: EmployeeDetail; onClose: () => void }) {
  const teams = useTeamOptions();
  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const editing = !!employee;
  const schema = editing ? employeeFormSchema.omit({ password: true }) : employeeFormSchema;

  const { register, handleSubmit, setError, setValue, control, formState } = useForm<EmployeeFormInput, unknown, EmployeeFormOutput>({
    resolver: zodResolver(schema as typeof employeeFormSchema),
    defaultValues: {
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      employeeCode: employee?.employeeCode ?? '',
      jobTitle: employee?.jobTitle ?? '',
      teamId: employee?.team?.id ?? '',
      password: '',
    },
  });
  useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  const watchedTeamId = useWatch({ control, name: 'teamId' });
  const selectedTeam = teams.data?.find((t) => t.id === watchedTeamId);

  const onSubmit = async (values: EmployeeFormOutput) => {
    setFormError(null);
    try {
      if (employee) {
        const changes: UpdateEmployeeInput = {};
        if (values.name !== employee.name) changes.name = values.name;
        if (values.email !== employee.email) changes.email = values.email;
        if (values.employeeCode !== employee.employeeCode) changes.employeeCode = values.employeeCode;
        if (values.jobTitle !== employee.jobTitle) changes.jobTitle = values.jobTitle;
        if (values.teamId !== employee.team?.id) changes.teamId = values.teamId;
        if (Object.keys(changes).length) {
          await update.mutateAsync(changes);
          toast.success(changes.teamId ? `${values.name} moved to ${selectedTeam?.name ?? 'the new team'}.` : 'Employee updated.');
        }
      } else {
        await create.mutateAsync(values);
        toast.success(`${values.name} was added.`);
      }
      onClose();
    } catch (error) {
      setFormError(
        applyApiError(error, setError, ['name', 'email', 'employeeCode', 'jobTitle', 'teamId', 'password'], {
          EMAIL_TAKEN: 'email',
          EMPLOYEE_CODE_TAKEN: 'employeeCode',
          INVALID_TEAM: 'teamId',
        }),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={editing ? `Edit ${employee.name}` : 'Add Employee'}
        description={editing ? 'Changing the team moves them and keeps their history.' : 'Create an employee account in a team.'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6">
          <FormSection title="Basic information">
            <Field label="Full name" error={formState.errors.name?.message}>
              {(c) => <Input {...c} {...register('name')} autoComplete="off" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email" error={formState.errors.email?.message}>
                {(c) => <Input {...c} {...register('email')} type="email" autoComplete="off" />}
              </Field>
              <Field label="Employee ID" hint="e.g. ZMP-0042" error={formState.errors.employeeCode?.message}>
                {(c) => <Input {...c} {...register('employeeCode')} autoComplete="off" />}
              </Field>
            </div>
          </FormSection>
          <FormSection title="Team and role">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Team" error={formState.errors.teamId?.message}>
                {(c) => (
                  <Select {...c} {...register('teamId')}>
                    <option value="">Choose a team</option>
                    {(teams.data ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Job role" hint="e.g. Software Engineer" error={formState.errors.jobTitle?.message}>
                {(c) => <Input {...c} {...register('jobTitle')} />}
              </Field>
            </div>
            <p className="rounded-md bg-surface-subtle px-3.5 py-2.5 text-sm text-ink-secondary">
              Manager / Admin:{' '}
              <span className="font-medium text-ink">
                {selectedTeam ? (selectedTeam.owner?.name ?? 'This team has no admin yet') : 'Set by the chosen team'}
              </span>
            </p>
          </FormSection>
          {!editing && (
            <FormSection title="Account access">
              <PasswordField
                register={register}
                name="password"
                error={formState.errors.password?.message}
                onGenerate={() => setValue('password', generatePassword(), { shouldDirty: true, shouldValidate: true })}
              />
            </FormSection>
          )}
          <FormAlert message={formError} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type AdminFormInput = z.input<typeof createAdminSchema>;
type AdminFormOutput = z.output<typeof createAdminSchema>;

/** Add Admin: name → email → role → team scope → access; scope stays visually obvious (Frontend.md §83). */
export function AdminFormDialog({ admin, onClose }: { admin?: AdminListItem; onClose: () => void }) {
  const teams = useTeamOptions();
  const create = useCreateAdmin();
  const update = useUpdateAdmin(admin?.id ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const editing = !!admin;
  const schema = editing ? createAdminSchema.omit({ password: true }) : createAdminSchema;

  const { register, handleSubmit, setError, setValue, control, formState } = useForm<AdminFormInput, unknown, AdminFormOutput>({
    resolver: zodResolver(schema as typeof createAdminSchema),
    defaultValues: {
      name: admin?.name ?? '',
      email: admin?.email ?? '',
      employeeCode: admin?.employeeCode ?? '',
      jobTitle: admin?.jobTitle ?? '',
      teamIds: admin?.teams.map((t) => t.id) ?? [],
      password: '',
    },
  });
  useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);
  const teamIds = useWatch({ control, name: 'teamIds' }) ?? [];

  const toggleTeam = (id: string) =>
    setValue('teamIds', teamIds.includes(id) ? teamIds.filter((t) => t !== id) : [...teamIds, id], { shouldDirty: true });

  const onSubmit = async (values: AdminFormOutput) => {
    setFormError(null);
    try {
      if (admin) {
        const changes: UpdateAdminInput = {};
        if (values.name !== admin.name) changes.name = values.name;
        if (values.email !== admin.email) changes.email = values.email;
        if (values.employeeCode !== admin.employeeCode) changes.employeeCode = values.employeeCode;
        if (values.jobTitle !== admin.jobTitle) changes.jobTitle = values.jobTitle;
        const current = admin.teams.map((t) => t.id).sort().join();
        if ([...values.teamIds].sort().join() !== current) changes.teamIds = values.teamIds;
        if (Object.keys(changes).length) {
          await update.mutateAsync(changes);
          toast.success('Admin updated.');
        }
      } else {
        await create.mutateAsync(values);
        toast.success(`${values.name} was added as an admin.`);
      }
      onClose();
    } catch (error) {
      setFormError(
        applyApiError(error, setError, ['name', 'email', 'employeeCode', 'jobTitle', 'teamIds', 'password'], {
          EMAIL_TAKEN: 'email',
          EMPLOYEE_CODE_TAKEN: 'employeeCode',
          INVALID_TEAM: 'teamIds',
        }),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={editing ? `Edit ${admin.name}` : 'Add Admin'}
        description="Admins manage the work of the teams they own — nothing outside that scope."
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6">
          <FormSection title="Basic information">
            <Field label="Full name" error={formState.errors.name?.message}>
              {(c) => <Input {...c} {...register('name')} autoComplete="off" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email" error={formState.errors.email?.message}>
                {(c) => <Input {...c} {...register('email')} type="email" autoComplete="off" />}
              </Field>
              <Field label="Employee ID" error={formState.errors.employeeCode?.message}>
                {(c) => <Input {...c} {...register('employeeCode')} autoComplete="off" />}
              </Field>
            </div>
            <Field label="Job role" hint="System role: Admin" error={formState.errors.jobTitle?.message}>
              {(c) => <Input {...c} {...register('jobTitle')} />}
            </Field>
          </FormSection>
          <FormSection title="Team scope">
            <p className="-mt-2 text-meta text-ink-muted">The teams this admin manages. Choosing a team owned by someone else moves it to this admin.</p>
            <ul className="grid gap-2">
              {(teams.data ?? []).map((team) => {
                const checked = teamIds.includes(team.id);
                const ownedElsewhere = team.owner && team.owner.id !== admin?.id;
                return (
                  <li key={team.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border-subtle px-3.5 py-2.5 text-sm transition-colors hover:bg-surface-row has-checked:border-primary-muted has-checked:bg-primary-selected">
                      <input type="checkbox" checked={checked} onChange={() => toggleTeam(team.id)} className="size-4 accent-primary-strong" />
                      <span className="flex-1 font-medium text-ink">{team.name}</span>
                      <span className="text-meta text-ink-muted">
                        {ownedElsewhere ? `Currently ${team.owner!.name}` : team.owner ? 'Owned by this admin' : 'No admin'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {formState.errors.teamIds?.message && <p className="text-meta text-danger-ink">{formState.errors.teamIds.message}</p>}
          </FormSection>
          {!editing && (
            <FormSection title="Account access">
              <PasswordField
                register={register}
                name="password"
                error={formState.errors.password?.message}
                onGenerate={() => setValue('password', generatePassword(), { shouldDirty: true, shouldValidate: true })}
              />
            </FormSection>
          )}
          <FormAlert message={formError} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {editing ? 'Save changes' : 'Create Admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
