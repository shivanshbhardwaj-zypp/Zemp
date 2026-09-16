export const SYSTEM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'EMPLOYEE'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  SUB_ADMIN: 'Sub Admin',
  EMPLOYEE: 'Employee',
};

/**
 * A Sub Admin is a co-admin inside one team: an admin promotes a member of a team they own, and the
 * member keeps their own work while gaining the admin's powers over that team only.
 */
export const isTeamManagerRole = (role: SystemRole) => role === 'ADMIN' || role === 'SUB_ADMIN';

/** Roles that belong to a team as members who do the work and appear in its reports. */
export const isTeamMemberRole = (role: SystemRole) => role === 'EMPLOYEE' || role === 'SUB_ADMIN';

/** Roles an admin or Super Admin may move a person between (never an admin's own role). */
export const DELEGATABLE_ROLES = ['EMPLOYEE', 'SUB_ADMIN'] as const;
export type DelegatableRole = (typeof DELEGATABLE_ROLES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/** Assigned by a manager, or logged by the employee themselves for review (requirements §39 "Approvals"). */
export const TASK_ORIGINS = ['ASSIGNED', 'SELF_REPORTED'] as const;
export type TaskOrigin = (typeof TASK_ORIGINS)[number];

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'CHANGES_REQUESTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
};

/** Operational deadline/workload indicator — never a judgement of the person. */
export const RISK_LEVELS = ['ON_TRACK', 'AT_RISK', 'OVERDUE', 'COMPLETED'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LABELS: Record<RiskLevel, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  OVERDUE: 'Overdue',
  COMPLETED: 'Completed',
};

export const DEADLINE_STATES = [
  'OVERDUE',
  'DUE_TODAY',
  'DUE_TOMORROW',
  'UPCOMING',
  'COMPLETED_ON_TIME',
  'COMPLETED_LATE',
  'CANCELLED',
] as const;
export type DeadlineState = (typeof DEADLINE_STATES)[number];

export const TASK_ACTIVITY_TYPES = [
  'CREATED',
  'ASSIGNED',
  'REASSIGNED',
  'UPDATED',
  'PRIORITY_CHANGED',
  'DUE_DATE_CHANGED',
  'STATUS_CHANGED',
  'PROGRESS_CHANGED',
  'COMMENT_ADDED',
  'COMPLETED',
  'REOPENED',
  'CANCELLED',
  'SUBMITTED_FOR_REVIEW',
  'REVIEW_APPROVED',
  'REVIEW_CHANGES_REQUESTED',
] as const;
export type TaskActivityType = (typeof TASK_ACTIVITY_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_REASSIGNED',
  'TASK_COMPLETED',
  'TASK_BLOCKED',
  'TASK_CANCELLED',
  'TASK_REOPENED',
  'TASK_UPDATED',
  'COMMENT_ADDED',
  'DEADLINE_APPROACHING',
  'TASK_OVERDUE',
  'REVIEW_REQUESTED',
  'REVIEW_APPROVED',
  'REVIEW_CHANGES_REQUESTED',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AUDIT_ACTIONS = [
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'AUTH_LOGIN_FAILED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_ISSUED',
  'PASSWORD_RESET_COMPLETED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'USER_ROLE_CHANGED',
  'TEAM_CREATED',
  'TEAM_UPDATED',
  'TEAM_MEMBER_MOVED',
  'TASK_ASSIGNED',
  'TASK_REASSIGNED',
  'TASK_DUE_DATE_CHANGED',
  'TASK_CANCELLED',
  'TASK_SELF_REPORTED',
  'TASK_REVIEW_APPROVED',
  'TASK_REVIEW_CHANGES_REQUESTED',
  'SETTINGS_UPDATED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESULTS = ['SUCCESS', 'FAILURE'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const AUDIT_RESOURCE_TYPES = ['USER', 'TEAM', 'TASK', 'SESSION', 'ORGANIZATION'] as const;
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];
