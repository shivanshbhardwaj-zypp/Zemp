import type { RiskLevel, TaskSummary } from '@zemp/shared';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'blocked';

const FILLS: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  blocked: 'bg-blocked',
};

/** Colour follows backend-provided state (Frontend.md §29), never a local formula. */
export function toneForTask(task: Pick<TaskSummary, 'status' | 'isOverdue' | 'risk'>): ProgressTone {
  if (task.status === 'COMPLETED') return 'success';
  if (task.isOverdue) return 'danger';
  if (task.status === 'BLOCKED') return 'blocked';
  return task.risk === 'AT_RISK' ? 'warning' : 'primary';
}

export function toneForRisk(risk: RiskLevel | null): ProgressTone {
  return risk === 'OVERDUE' ? 'danger' : risk === 'AT_RISK' ? 'warning' : risk === 'COMPLETED' ? 'success' : 'primary';
}

interface ProgressBarProps {
  value: number;
  label: string;
  tone?: ProgressTone;
  showValue?: boolean;
  digits?: number;
  size?: 'sm' | 'md';
  className?: string;
}

/** Bar plus a visible percentage and an accessible name (Frontend.md §142). */
export function ProgressBar({ value, label, tone = 'primary', showValue = true, digits = 0, size = 'md', className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        className={cn('relative min-w-12 flex-1 overflow-hidden rounded-full bg-track', size === 'sm' ? 'h-1.5' : 'h-2')}
      >
        <div
          className={cn('h-full w-full rounded-full transition-transform duration-300 ease-out', FILLS[tone])}
          style={{ transform: `translateX(${clamped - 100}%)` }}
        />
      </div>
      {showValue && (
        <span className="w-12 shrink-0 text-right text-meta font-medium text-ink-secondary tabular">
          {formatPercent(clamped, digits)}
        </span>
      )}
    </div>
  );
}
