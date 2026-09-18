import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_RESULTS,
  DELEGATABLE_ROLES,
  REVIEW_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from './enums.js';
import { daysBetween, isValidTimeZone } from './time.js';

/**
 * Request validation shared by the API (authoritative) and forms (early feedback, Frontend.md §98).
 */

// ── Primitives ─────────────────────────────────────────────────────────────

export const idSchema = z.uuid({ error: 'Choose a valid item' });
export const dateKeySchema = z.iso.date({ error: 'Use the YYYY-MM-DD date format' });
export const dateTimeSchema = z.iso.datetime({ offset: true, error: 'Enter a valid date and time' });
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }));

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `Enter ${label.toLowerCase()}` : `${label} needs at least ${min} characters`)
    .max(max, `${label} can be at most ${max} characters`);

const employeeCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,20}$/, 'Use 3–20 letters, numbers or dashes');

/** Query-string lists are comma separated: `status=TODO,IN_PROGRESS`. */
const csvOf = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
    z.array(item).min(1),
  );

const sortOrderSchema = z.enum(['asc', 'desc']);

const hasAnyField = (value: Record<string, unknown>) =>
  Object.values(value).some((v) => v !== undefined);
const anyField = { message: 'Change at least one field' };

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a new password that differs from the current one',
  });

export const passwordResetRequestSchema = z.object({ email: emailSchema });

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: passwordSchema,
});

// ── Tasks ──────────────────────────────────────────────────────────────────

const incentiveAmountSchema = z.number().min(0).max(1_000_000);

export const createTaskSchema = z.object({
  title: text('Title', 3, 200),
  description: z.string().trim().max(5000).optional(),
  assigneeId: idSchema,
  teamId: idSchema.optional(),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  startAt: dateTimeSchema.optional(),
  dueAt: dateTimeSchema,
  incentiveAmount: incentiveAmountSchema.optional(),
});

export const updateTaskSchema = z
  .object({
    title: text('Title', 3, 200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    startAt: dateTimeSchema.nullable().optional(),
    dueAt: dateTimeSchema.optional(),
    incentiveAmount: incentiveAmountSchema.nullable().optional(),
  })
  .refine(hasAnyField, anyField);

export const reassignTaskSchema = z.object({
  assigneeId: idSchema,
  teamId: idSchema.optional(),
});

export const updateProgressSchema = z.object({
  progress: z
    .number({ error: 'Progress must be a number' })
    .int('Progress must be a whole number')
    .min(0, 'Progress cannot be below 0')
    .max(100, 'Progress cannot be above 100'),
});

export const changeStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const createCommentSchema = z.object({ body: text('A comment', 1, 2000) });

// ── Self-reported work & review ────────────────────────────────────────────

/** Only http(s), so a stored link can never carry a `javascript:` or `data:` payload. */
const evidenceUrlSchema = z
  .string()
  .trim()
  .max(2000, 'That link is too long')
  .pipe(z.url({ error: 'Enter a valid link' }))
  .refine((v) => /^https?:\/\//i.test(v), 'Use a link starting with http:// or https://');

const selfReportFields = {
  title: text('Title', 3, 200),
  description: text('What you did', 10, 5000),
  evidenceUrl: evidenceUrlSchema.optional(),
  completedAt: dateTimeSchema,
};

export const selfReportSchema = z.object({ ...selfReportFields, reviewerId: idSchema });

export const resubmitSelfReportSchema = z
  .object({
    title: selfReportFields.title.optional(),
    description: selfReportFields.description.optional(),
    evidenceUrl: evidenceUrlSchema.nullable().optional(),
    completedAt: dateTimeSchema.optional(),
  })
  .refine(hasAnyField, anyField);

export const reviewDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REQUEST_CHANGES']),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.decision === 'APPROVE' || Boolean(v.note), {
    message: 'Tell the author what needs changing',
    path: ['note'],
  });

export const listReviewsQuerySchema = pageQuerySchema.extend({
  status: z.enum(REVIEW_STATUSES).default('PENDING'),
});

/** Promote a team member to Sub Admin, or return them to Employee. */
export const changeRoleSchema = z.object({ role: z.enum(DELEGATABLE_ROLES) });

export const TASK_SORT_FIELDS = ['dueAt', 'createdAt', 'updatedAt', 'priority', 'status', 'progress', 'title'] as const;
export const DEADLINE_FILTERS = ['OVERDUE', 'DUE_TODAY', 'DUE_TOMORROW', 'UPCOMING'] as const;

export const listTasksQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: csvOf(z.enum(TASK_STATUSES)).optional(),
  priority: csvOf(z.enum(TASK_PRIORITIES)).optional(),
  teamId: idSchema.optional(),
  assigneeId: z.union([idSchema, z.literal('me')]).optional(),
  adminId: idSchema.optional(),
  dueFrom: dateKeySchema.optional(),
  dueTo: dateKeySchema.optional(),
  assignedFrom: dateKeySchema.optional(),
  assignedTo: dateKeySchema.optional(),
  deadline: z.enum(DEADLINE_FILTERS).optional(),
  sort: z.enum(TASK_SORT_FIELDS).default('dueAt'),
  order: sortOrderSchema.default('asc'),
});

export const assignableUsersQuerySchema = z.object({
  teamId: idSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

// ── People & teams ─────────────────────────────────────────────────────────

const personFields = {
  name: text('Name', 2, 100),
  email: emailSchema,
  employeeCode: employeeCodeSchema,
  jobTitle: text('Job title', 2, 100),
};

export const createEmployeeSchema = z.object({
  ...personFields,
  teamId: idSchema,
  password: passwordSchema,
});

export const updateEmployeeSchema = z
  .object({
    name: personFields.name.optional(),
    email: emailSchema.optional(),
    employeeCode: employeeCodeSchema.optional(),
    jobTitle: personFields.jobTitle.optional(),
    teamId: idSchema.optional(),
  })
  .refine(hasAnyField, anyField);

export const createAdminSchema = z.object({
  ...personFields,
  teamIds: z.array(idSchema).max(20).default([]),
  password: passwordSchema,
});

export const updateAdminSchema = z
  .object({
    name: personFields.name.optional(),
    email: emailSchema.optional(),
    employeeCode: employeeCodeSchema.optional(),
    jobTitle: personFields.jobTitle.optional(),
    teamIds: z.array(idSchema).max(20).optional(),
  })
  .refine(hasAnyField, anyField);

export const PEOPLE_SORT_FIELDS = ['name', 'employeeCode', 'createdAt'] as const;

export const listPeopleQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  teamId: idSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(PEOPLE_SORT_FIELDS).default('name'),
  order: sortOrderSchema.default('asc'),
});

export const createTeamSchema = z.object({
  name: text('Team name', 2, 80),
  description: z.string().trim().max(500).optional(),
  ownerId: idSchema.nullable().optional(),
});

export const updateTeamSchema = z
  .object({
    name: text('Team name', 2, 80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    ownerId: idSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasAnyField, anyField);

export const addTeamMemberSchema = z.object({ userId: idSchema });

export const listTeamsQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum(['name', 'createdAt']).default('name'),
  order: sortOrderSchema.default('asc'),
});

// ── Dashboard & reports ────────────────────────────────────────────────────

export const MAX_PROGRESS_RANGE_DAYS = 31;

const reportScopeFields = {
  teamId: idSchema.optional(),
  adminId: idSchema.optional(),
  employeeId: idSchema.optional(),
};

export const dailyReportQuerySchema = z.object({ date: dateKeySchema.optional(), ...reportScopeFields });

export const progressReportQuerySchema = z
  .object({ from: dateKeySchema, to: dateKeySchema, ...reportScopeFields })
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'End date must be on or after the start date' })
  .refine((v) => daysBetween(v.from, v.to) < MAX_PROGRESS_RANGE_DAYS, {
    path: ['to'],
    message: `Choose a range of ${MAX_PROGRESS_RANGE_DAYS} days or fewer`,
  });

export const activityFeedQuerySchema = z.object({
  date: dateKeySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  ...reportScopeFields,
});

// ── Notifications, audit, settings ────────────────────────────────────────

export const listNotificationsQuerySchema = pageQuerySchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const listAuditLogsQuerySchema = pageQuerySchema.extend({
  actorId: idSchema.optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  resourceType: z.enum(AUDIT_RESOURCE_TYPES).optional(),
  result: z.enum(AUDIT_RESULTS).optional(),
  from: dateKeySchema.optional(),
  to: dateKeySchema.optional(),
});

export const updateOrganizationSchema = z
  .object({
    name: text('Organization name', 2, 100).optional(),
    timezone: z.string().refine(isValidTimeZone, 'Choose a valid time zone').optional(),
  })
  .refine(hasAnyField, anyField);

// ── Input types ────────────────────────────────────────────────────────────

export type LoginInput = z.output<typeof loginSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
export type PasswordResetRequestInput = z.output<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.output<typeof passwordResetConfirmSchema>;
export type CreateTaskInput = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.output<typeof updateTaskSchema>;
export type ReassignTaskInput = z.output<typeof reassignTaskSchema>;
export type SelfReportInputDto = z.output<typeof selfReportSchema>;
export type ResubmitSelfReportInput = z.output<typeof resubmitSelfReportSchema>;
export type ReviewDecisionInput = z.output<typeof reviewDecisionSchema>;
export type ListReviewsQuery = z.output<typeof listReviewsQuerySchema>;
export type ChangeRoleInput = z.output<typeof changeRoleSchema>;
export type UpdateProgressInput = z.output<typeof updateProgressSchema>;
export type ChangeStatusInput = z.output<typeof changeStatusSchema>;
export type CreateCommentInput = z.output<typeof createCommentSchema>;
export type ListTasksQuery = z.output<typeof listTasksQuerySchema>;
export type AssignableUsersQuery = z.output<typeof assignableUsersQuerySchema>;
export type CreateEmployeeInput = z.output<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.output<typeof updateEmployeeSchema>;
export type CreateAdminInput = z.output<typeof createAdminSchema>;
export type UpdateAdminInput = z.output<typeof updateAdminSchema>;
export type ListPeopleQuery = z.output<typeof listPeopleQuerySchema>;
export type CreateTeamInput = z.output<typeof createTeamSchema>;
export type UpdateTeamInput = z.output<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.output<typeof addTeamMemberSchema>;
export type ListTeamsQuery = z.output<typeof listTeamsQuerySchema>;
export type DailyReportQuery = z.output<typeof dailyReportQuerySchema>;
export type ProgressReportQuery = z.output<typeof progressReportQuerySchema>;
export type ActivityFeedQuery = z.output<typeof activityFeedQuerySchema>;
export type ListNotificationsQuery = z.output<typeof listNotificationsQuerySchema>;
export type ListAuditLogsQuery = z.output<typeof listAuditLogsQuerySchema>;
export type UpdateOrganizationInput = z.output<typeof updateOrganizationSchema>;
