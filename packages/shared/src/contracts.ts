import type {
  AuditAction,
  AuditResourceType,
  AuditResult,
  DeadlineState,
  NotificationType,
  ReviewStatus,
  RiskLevel,
  SystemRole,
  TaskActivityType,
  TaskOrigin,
  TaskPriority,
  TaskStatus,
} from './enums.js';
import type { ErrorCode } from './errors.js';
import type { Permission } from './permissions.js';
import type { TaskPermissions } from './domain/tasks.js';
import type { WorkloadSummary } from './domain/workload.js';

/** API response contract for /api/v1. All timestamps are ISO-8601 UTC strings. */

// ── Envelope ───────────────────────────────────────────────────────────────

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface ValidationDetails {
  fieldErrors: Record<string, string[]>;
  formErrors: string[];
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ValidationDetails;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

// ── References ─────────────────────────────────────────────────────────────

export interface UserRef {
  id: string;
  name: string;
  role: SystemRole;
  isActive: boolean;
  jobTitle: string | null;
}

export interface TeamRef {
  id: string;
  name: string;
}

export interface TaskRef {
  id: string;
  title: string;
}

/** Who a page's numbers describe (Frontend.md §175–176). */
export interface ScopeInfo {
  kind: 'ORGANIZATION' | 'TEAM' | 'PERSON' | 'SELF';
  label: string;
  detail: string;
}

// ── Session ────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  permissions: Permission[];
  jobTitle: string | null;
  employeeCode: string | null;
  team: TeamRef | null;
  manager: UserRef | null;
  ownedTeams: TeamRef[];
  organization: { name: string; timezone: string };
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  startAt: string | null;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserRef;
  assignor: UserRef;
  team: TeamRef | null;
  isOverdue: boolean;
  deadlineState: DeadlineState;
  risk: RiskLevel | null;
  /** Status changes this user may make right now — the UI never offers anything else. */
  allowedTransitions: TaskStatus[];
  permissions: TaskPermissions;
  origin: TaskOrigin;
  /** Optional link the author gave as evidence of self-reported work. */
  evidenceUrl: string | null;
  /** Null for assigned work. */
  review: TaskReview | null;
  /** Set by whoever assigned/edited the task — a bonus in rupees for completing it. Null means none. */
  incentiveAmount: number | null;
}

export interface TaskReview {
  status: ReviewStatus;
  reviewer: UserRef | null;
  reviewedAt: string | null;
  /** The reviewer's note — required when changes are requested. */
  note: string | null;
}

export interface TaskDetail extends TaskSummary {
  description: string | null;
  completionNote: string | null;
  createdBy: UserRef;
  updatedBy: UserRef;
  commentCount: number;
}

/** One line of the viewer's own incentive breakdown — a task and what it's worth. */
export interface IncentiveTaskLine {
  taskId: string;
  title: string;
  status: TaskStatus;
  amount: number;
  /** Set once the task is completed — that's when the amount is actually earned. */
  completedAt: string | null;
  dueAt: string;
}

/** The signed-in person's own incentivized tasks — never anyone else's (GET /incentives). */
export interface IncentiveOverview {
  tasks: IncentiveTaskLine[];
  /** Sum for completed incentivized tasks. */
  totalEarned: number;
  /** Sum for open incentivized tasks — not yet earned. */
  totalPending: number;
}

export interface TaskActivityEntry {
  id: string;
  type: TaskActivityType;
  actor: UserRef;
  fromValue: string | null;
  toValue: string | null;
  /** Human-readable values, e.g. names for reassignment, labels for status. */
  fromLabel: string | null;
  toLabel: string | null;
  note: string | null;
  createdAt: string;
}

export interface ActivityFeedItem extends TaskActivityEntry {
  task: TaskRef;
}

export interface TaskCommentEntry {
  id: string;
  body: string;
  author: UserRef;
  createdAt: string;
}

export interface AssignableUser extends UserRef {
  team: TeamRef | null;
  ownedTeams: TeamRef[];
}

/** Someone an employee may send their work to for review. */
export interface ReviewerOption extends UserRef {
  team: TeamRef | null;
  /** Why they can review: they own the employee's team, or they oversee the organization. */
  relationship: 'TEAM_ADMIN' | 'SUPER_ADMIN';
}

// ── Progress ───────────────────────────────────────────────────────────────

export interface PersonProgress {
  user: UserRef;
  team: TeamRef | null;
  workload: WorkloadSummary;
  completedToday: number;
  risk: RiskLevel | null;
}

export interface TeamProgress {
  team: TeamRef;
  owner: UserRef | null;
  memberCount: number;
  workload: WorkloadSummary;
  completedToday: number;
  risk: RiskLevel | null;
}

// ── People ─────────────────────────────────────────────────────────────────

export interface EmployeeListItem {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  jobTitle: string | null;
  role: SystemRole;
  isActive: boolean;
  team: TeamRef | null;
  manager: UserRef | null;
  workload: WorkloadSummary;
  risk: RiskLevel | null;
  createdAt: string;
}

export interface EmployeeDetail extends EmployeeListItem {
  /** Contact number from the personnel record, when one is on file. */
  phone: string | null;
  lastLoginAt: string | null;
  ownedTeams: TeamRef[];
  completedToday: number;
  permissions: {
    canEdit: boolean;
    canChangeStatus: boolean;
    canResetPassword: boolean;
    /** The viewer may make this person a Sub Admin of their team, or return them to Employee. */
    canDelegate: boolean;
  };
}

export interface PeopleStats {
  total: number;
  active: number;
  inactive: number;
  teams: number;
  averageActiveTasks: number;
}

export interface AdminListItem {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  jobTitle: string | null;
  isActive: boolean;
  teams: TeamRef[];
  employeeCount: number;
  workload: WorkloadSummary;
  risk: RiskLevel | null;
  createdAt: string;
}

export interface PasswordResetIssued {
  resetUrl: string;
  expiresAt: string;
}

// ── Teams ──────────────────────────────────────────────────────────────────

export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  owner: UserRef | null;
  memberCount: number;
  workload: WorkloadSummary;
  atRiskMembers: number;
  risk: RiskLevel | null;
  createdAt: string;
}

export interface TeamDetail extends TeamListItem {
  permissions: { canEdit: boolean; canManageMembers: boolean };
}

export interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  employeeCode: string | null;
  jobTitle: string | null;
  /** EMPLOYEE, or SUB_ADMIN for a member promoted to co-run this team. */
  role: SystemRole;
  isActive: boolean;
  joinedAt: string;
  workload: WorkloadSummary;
  risk: RiskLevel | null;
  /** Whether the viewer may change this member's role here. */
  canDelegate: boolean;
}

export interface OrgChartTeam extends TeamRef {
  isActive: boolean;
  memberCount: number;
}

export interface OrgChartAdmin extends UserRef {
  teams: OrgChartTeam[];
  employeeCount: number;
}

export interface OrgChart {
  superAdmins: UserRef[];
  admins: OrgChartAdmin[];
  unownedTeams: OrgChartTeam[];
  totals: { admins: number; employees: number; teams: number };
}

// ── Dashboard & reports ────────────────────────────────────────────────────

export interface DashboardSummary {
  date: string;
  scope: ScopeInfo;
  workload: WorkloadSummary;
  completedToday: number;
  assignedToday: number;
  atRiskTasks: number;
  /** People in scope; null on an employee's own dashboard. */
  people: { total: number; active: number } | null;
  /** Self-reported submissions waiting on this viewer (reviewers) or on their reviewer (employees). */
  pendingReviews: number;
}

export interface DashboardAttention {
  overdue: TaskSummary[];
  blocked: TaskSummary[];
  dueSoon: TaskSummary[];
  atRiskPeople: PersonProgress[];
  atRiskTeams: TeamProgress[];
  inactivePeople: number | null;
}

export interface DailyTrendPoint {
  date: string;
  assigned: number;
  completed: number;
}

export interface DailyReport {
  date: string;
  isToday: boolean;
  /** LIVE for today; SNAPSHOT when counts come from stored daily progress snapshots. */
  source: 'LIVE' | 'SNAPSHOT';
  scope: ScopeInfo;
  summary: {
    assignedToday: number;
    completedToday: number;
    inProgress: number;
    blocked: number;
    overdue: number;
    completionRate: number;
    activeEmployees: number;
    activeAdmins: number;
    atRiskPeople: number;
  };
  workload: WorkloadSummary;
  teams: TeamProgress[];
  people: PersonProgress[];
  trend: DailyTrendPoint[];
}

export interface ProgressPoint {
  date: string;
  total: number;
  completed: number;
  completionRate: number;
}

export interface ProgressReport {
  from: string;
  to: string;
  days: string[];
  scope: ScopeInfo;
  totals: ProgressPoint[];
  rows: Array<{ user: UserRef; team: TeamRef | null; points: ProgressPoint[] }>;
}

// ── Notifications, audit, settings ────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  task: TaskRef | null;
  readAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  result: AuditResult;
  actor: UserRef | null;
  resourceType: AuditResourceType;
  resourceId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface OrganizationSettings {
  name: string;
  timezone: string;
  updatedAt: string;
}

export interface RoleMatrix {
  roles: Array<{ key: SystemRole; name: string; permissions: Permission[] }>;
  permissions: Array<{ key: Permission; description: string }>;
}
