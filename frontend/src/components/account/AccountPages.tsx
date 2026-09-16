'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PERMISSIONS,
  ROLE_LABELS,
  changePasswordSchema,
  type ChangePasswordInput,
  type Permission,
} from '@zemp/shared';
import { Check, CircleAlert, Minus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { EmployeeProfile } from '@/components/people/EmployeeProfile';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { authApi } from '@/lib/api/auth';
import { settingsApi } from '@/lib/api/settings';
import { applyApiError } from '@/lib/formErrors';
import { formatDateTime } from '@/lib/format';
import { sessionQueryKey, useCan, useTimeZone, useUser } from '@/lib/session';

/** Your own profile, reusing the employee profile view (Frontend.md §41, §50). */
export function ProfilePage() {
  const user = useUser();
  if (user.role === 'SUPER_ADMIN') {
    return (
      <>
        <PageHeader title="Profile" description={`${ROLE_LABELS[user.role]} · ${user.email}`} />
        <div className="grid max-w-3xl gap-6">
          <Card className="p-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['Name', user.name],
                ['Email', user.email],
                ['System role', ROLE_LABELS[user.role]],
                ['Job role', user.jobTitle ?? '—'],
                ['Organization', user.organization.name],
                ['Time zone', user.organization.timezone],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-meta text-ink-muted">{label}</dt>
                  <dd className="mt-0.5 font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <ChangePasswordCard />
        </div>
      </>
    );
  }
  return (
    <>
      <EmployeeProfile id={user.id} />
      <div className="mt-6 max-w-3xl">
        <ChangePasswordCard />
      </div>
    </>
  );
}

function ChangePasswordCard() {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = async (values: ChangePasswordInput) => {
    setFormError(null);
    try {
      await authApi.changePassword(values);
      toast.success('Password changed. Other sessions were signed out.');
      reset();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['currentPassword', 'newPassword'], { INVALID_CURRENT_PASSWORD: 'currentPassword' }));
    }
  };

  return (
    <Card>
      <CardHeader title="Password" description="Changing it signs you out everywhere else." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 p-5 sm:max-w-md">
        <Field label="Current password" error={formState.errors.currentPassword?.message}>
          {(c) => <Input {...c} {...register('currentPassword')} type="password" autoComplete="current-password" />}
        </Field>
        <Field label="New password" hint="At least 10 characters with a letter and a number." error={formState.errors.newPassword?.message}>
          {(c) => <Input {...c} {...register('newPassword')} type="password" autoComplete="new-password" />}
        </Field>
        {formError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger-ink">
            <CircleAlert className="size-4" aria-hidden />
            {formError}
          </p>
        )}
        <div>
          <Button type="submit" loading={formState.isSubmitting}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Limited V0.1 settings: account, and organization + roles for authorized users (Frontend.md §89). */
export function SettingsPage() {
  const can = useCan();
  const canSeeOrganization = can('settings.read');
  return (
    <>
      <PageHeader title="Settings" description="Account and organization settings" />
      <Tabs defaultValue="account">
        <TabsList aria-label="Settings sections" className="mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          {canSeeOrganization && <TabsTrigger value="organization">Organization</TabsTrigger>}
          {canSeeOrganization && <TabsTrigger value="roles">Roles & permissions</TabsTrigger>}
        </TabsList>
        <TabsContent value="account" className="max-w-3xl outline-none">
          <ChangePasswordCard />
        </TabsContent>
        {canSeeOrganization && (
          <TabsContent value="organization" className="max-w-3xl outline-none">
            <OrganizationCard />
          </TabsContent>
        )}
        {canSeeOrganization && (
          <TabsContent value="roles" className="outline-none">
            <RolesCard />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function OrganizationCard() {
  const can = useCan();
  const timeZone = useTimeZone();
  const queryClient = useQueryClient();
  const organization = useQuery({ queryKey: ['settings', 'organization'], queryFn: settingsApi.organization });
  const [draft, setDraft] = useState<{ name: string; timezone: string } | null>(null);
  const save = useMutation({
    mutationFn: settingsApi.updateOrganization,
    onSuccess: async () => {
      toast.success('Organization settings saved.');
      setDraft(null);
      await queryClient.invalidateQueries();
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Settings could not be saved.'),
  });

  if (organization.error) return <ErrorState onRetry={() => organization.refetch()} />;
  if (!organization.data) return <Skeleton className="h-56 w-full rounded-lg" />;
  const values = draft ?? { name: organization.data.name, timezone: organization.data.timezone };
  const editable = can('settings.update');
  const zones = Intl.supportedValuesOf('timeZone');

  return (
    <Card>
      <CardHeader title="Organization" description={`Last updated ${formatDateTime(organization.data.updatedAt, timeZone)}`} />
      <form
        className="grid gap-4 p-5 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            name: values.name !== organization.data.name ? values.name : undefined,
            timezone: values.timezone !== organization.data.timezone ? values.timezone : undefined,
          });
        }}
      >
        <Field label="Organization name">
          {(c) => <Input {...c} value={values.name} disabled={!editable} onChange={(e) => setDraft({ ...values, name: e.target.value })} />}
        </Field>
        <Field label="Time zone" hint="Deadlines, 'today' and daily reports use this time zone.">
          {(c) => (
            <Select {...c} value={values.timezone} disabled={!editable} onChange={(e) => setDraft({ ...values, timezone: e.target.value })}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {editable && (
          <div>
            <Button type="submit" loading={save.isPending} disabled={!draft}>
              Save changes
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

/** Read-only view of what each role may do; the server enforces it (requirements §19). */
function RolesCard() {
  const roles = useQuery({ queryKey: ['settings', 'roles'], queryFn: settingsApi.roles });
  if (roles.error) return <ErrorState onRetry={() => roles.refetch()} />;
  if (!roles.data) return <Skeleton className="h-96 w-full rounded-lg" />;
  const has = (roleKey: string, permission: Permission) => roles.data.roles.find((r) => r.key === roleKey)?.permissions.includes(permission);
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Roles & permissions" description="Admins are further limited to the teams they own; employees to their own work." />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">Permissions granted to each role</caption>
          <thead>
            <tr className="border-y border-border-subtle bg-surface-subtle">
              <th scope="col" className="px-5 py-3 text-left text-meta font-semibold text-ink-secondary">
                Permission
              </th>
              {roles.data.roles.map((role) => (
                <th key={role.key} scope="col" className="px-4 py-3 text-center text-meta font-semibold text-ink-secondary">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-b border-border-subtle last:border-0">
                <th scope="row" className="px-5 py-2.5 text-left font-normal">
                  <span className="block text-ink">{roles.data.permissions.find((p) => p.key === permission)?.description}</span>
                  <code className="text-xs text-ink-muted">{permission}</code>
                </th>
                {roles.data.roles.map((role) => (
                  <td key={role.key} className="px-4 py-2.5 text-center">
                    {has(role.key, permission) ? (
                      <Check className="mx-auto size-4 text-success-ink" role="img" aria-label="Allowed" />
                    ) : (
                      <Minus className="mx-auto size-4 text-ink-disabled" role="img" aria-label="Not allowed" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
