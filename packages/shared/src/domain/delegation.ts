import { ROLE_LABELS, type DelegatableRole, type SystemRole } from '../enums.js';
import { DomainError } from '../errors.js';
import { canDelegateRole, type PersonScope } from './access.js';
import type { AuditDraft, NamedActor, NotificationDraft } from './tasks.js';

/**
 * Sub Admins (requirements §39 "Custom roles", added to V0.1 at the user's request). An admin
 * promotes a member of a team they own to co-run that team; the person keeps their own work and
 * their team membership, and gains the admin's permissions scoped to that one team.
 */

export interface RoleChangePlan {
  patch: { role: DelegatableRole };
  notifications: NotificationDraft[];
  audits: AuditDraft[];
}

export interface DelegationTarget extends PersonScope {
  name: string;
  isActive: boolean;
}

export function planRoleChange(args: {
  actor: NamedActor;
  person: DelegationTarget;
  to: DelegatableRole;
  teamName?: string;
}): RoleChangePlan {
  const { actor, person, to } = args;
  // Scope first: someone outside the actor's teams must not be distinguishable from a stranger.
  if (!canDelegateRole(actor, person)) throw new DomainError('FORBIDDEN');
  if (person.id === actor.id) throw new DomainError('CANNOT_CHANGE_OWN_ACCOUNT');
  if (person.role === to) throw new DomainError('CONFLICT', `${person.name} is already ${ROLE_LABELS[to]}.`);
  if (!person.isActive) {
    throw new DomainError('VALIDATION_ERROR', 'Reactivate this account before changing what it can do.');
  }
  // A Sub Admin's authority is one team's; without a team there is nothing to delegate.
  if (to === 'SUB_ADMIN' && !person.teamId) {
    throw new DomainError('INVALID_TEAM', 'Add this person to a team before making them a Sub Admin.');
  }

  const promoted = to === 'SUB_ADMIN';
  const where = args.teamName ? ` for ${args.teamName}` : '';
  return {
    patch: { role: to },
    notifications: [
      {
        userId: person.id,
        type: 'SYSTEM',
        title: promoted ? 'You are now a Sub Admin' : 'Your access has changed',
        body: promoted
          ? `${actor.name} made you a Sub Admin${where}. You can now assign and review work for the team.`
          : `${actor.name} returned your access to ${ROLE_LABELS.EMPLOYEE}${where}.`,
      },
    ],
    audits: [
      {
        action: 'USER_ROLE_CHANGED',
        metadata: { from: person.role satisfies SystemRole, to, teamId: person.teamId },
      },
    ],
  };
}
