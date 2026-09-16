import type { RiskLevel } from '../enums.js';
import { DAY_MS, addDays, dayKey, startOfDay } from '../time.js';
import { isOpenStatus, type TaskRecord } from './tasks.js';

export type WorkloadTask = Pick<
  TaskRecord,
  'status' | 'progress' | 'dueAt' | 'startAt' | 'completedAt' | 'createdAt'
>;

export interface WorkloadSummary {
  total: number;
  completed: number;
  remaining: number;
  todo: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  dueToday: number;
  /** completed / total × 100, two decimals (requirements §10). */
  completionRate: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const completionRate = (completed: number, total: number) =>
  total === 0 ? 0 : round2((completed / total) * 100);

/**
 * Active workload on a day: every non-cancelled task that is still open, not yet due, or was
 * completed that day or later. Completed work whose deadline has passed drops out, so completion
 * rates describe current commitments instead of trending to 100% over all history.
 */
export function isInWorkload(task: WorkloadTask, dayStart: Date): boolean {
  if (task.status === 'CANCELLED') return false;
  return (
    isOpenStatus(task.status) ||
    task.dueAt >= dayStart ||
    (task.completedAt !== null && task.completedAt >= dayStart)
  );
}

export function summarizeWorkload(tasks: readonly WorkloadTask[], now: Date, timeZone: string): WorkloadSummary {
  const today = dayKey(now, timeZone);
  const dayStart = startOfDay(today, timeZone);
  const nextDayStart = startOfDay(addDays(today, 1), timeZone);
  const s: WorkloadSummary = {
    total: 0,
    completed: 0,
    remaining: 0,
    todo: 0,
    inProgress: 0,
    blocked: 0,
    overdue: 0,
    dueToday: 0,
    completionRate: 0,
  };
  for (const t of tasks) {
    if (!isInWorkload(t, dayStart)) continue;
    s.total++;
    if (t.status === 'COMPLETED') s.completed++;
    else if (t.status === 'TODO') s.todo++;
    else if (t.status === 'IN_PROGRESS') s.inProgress++;
    else if (t.status === 'BLOCKED') s.blocked++;
    if (isOpenStatus(t.status)) {
      if (t.dueAt < now) s.overdue++;
      else if (t.dueAt < nextDayStart) s.dueToday++;
    }
  }
  s.remaining = s.total - s.completed;
  s.completionRate = completionRate(s.completed, s.total);
  return s;
}

/**
 * Workload risk (requirements §14): required_daily_rate = remaining / remaining_days, compared with
 * the rate achieved so far. Checked against every deadline on the plate, so a pile of work due
 * tomorrow is not hidden by one task due next month. Within the first day pace is not yet measurable.
 */
export function workloadRisk(tasks: readonly WorkloadTask[], now: Date, timeZone: string): RiskLevel | null {
  const dayStart = startOfDay(dayKey(now, timeZone), timeZone);
  const relevant = tasks.filter((t) => isInWorkload(t, dayStart));
  if (relevant.length === 0) return null;
  const open = relevant.filter((t) => isOpenStatus(t.status));
  if (open.length === 0) return 'COMPLETED';
  if (open.some((t) => t.dueAt < now)) return 'OVERDUE';

  const start = Math.min(...relevant.map((t) => (t.startAt ?? t.createdAt).getTime()));
  const elapsedDays = (now.getTime() - start) / DAY_MS;
  if (elapsedDays < 1) return 'ON_TRACK';
  const achievedDailyRate = (relevant.length - open.length) / elapsedDays;

  const dueTimes = open.map((t) => t.dueAt.getTime()).sort((a, b) => a - b);
  for (let i = 0; i < dueTimes.length; i++) {
    const deadline = dueTimes[i]!;
    if (dueTimes[i + 1] === deadline) continue;
    const remainingDays = Math.max((deadline - now.getTime()) / DAY_MS, 1 / 24);
    const requiredDailyRate = (i + 1) / remainingDays;
    if (requiredDailyRate > achievedDailyRate) return 'AT_RISK';
  }
  return 'ON_TRACK';
}
