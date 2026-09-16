'use client';

import type { SystemRole } from '@zemp/shared';
import { ShieldMinus, ShieldPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { useChangeRole } from '@/hooks/usePeople';

/**
 * Promote a team member to Sub Admin — a co-admin for that team — or return them to Employee.
 * Only offered when the API says this viewer may do it; the API checks again on the call.
 */
export function DelegateAction({
  person,
  size = 'sm',
  variant = 'secondary',
}: {
  person: { id: string; name: string; role: SystemRole; teamName?: string | null };
  size?: 'sm' | 'md';
  variant?: 'secondary' | 'ghost';
}) {
  const [confirming, setConfirming] = useState(false);
  const changeRole = useChangeRole(person.id);
  const isSubAdmin = person.role === 'SUB_ADMIN';
  const where = person.teamName ? ` of ${person.teamName}` : '';

  const apply = async () => {
    try {
      await changeRole.mutateAsync({ role: isSubAdmin ? 'EMPLOYEE' : 'SUB_ADMIN' });
      toast.success(isSubAdmin ? `${person.name} is an employee again.` : `${person.name} is now a Sub Admin.`);
      setConfirming(false);
    } catch {
      toast.error('That change could not be saved. Try again.');
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setConfirming(true)} disabled={changeRole.isPending}>
        {isSubAdmin ? <ShieldMinus /> : <ShieldPlus />}
        {isSubAdmin ? 'Remove Sub Admin' : 'Make Sub Admin'}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={isSubAdmin ? `Remove ${person.name} as Sub Admin?` : `Make ${person.name} a Sub Admin?`}
        description={
          isSubAdmin
            ? `${person.name} keeps their own tasks but loses the ability to assign work, review submissions and see team reports.`
            : `${person.name} will co-run the team${where}: assigning and reassigning work, reviewing work teammates log, and seeing team reports. They keep their own tasks, and cannot add or remove people, edit the team, or appoint other Sub Admins.`
        }
        confirmLabel={isSubAdmin ? 'Remove Sub Admin' : 'Make Sub Admin'}
        destructive={isSubAdmin}
        loading={changeRole.isPending}
        onConfirm={apply}
      />
    </>
  );
}
