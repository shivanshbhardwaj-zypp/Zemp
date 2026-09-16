import {
  RISK_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type RiskLevel,
  type TaskPriority,
  type TaskStatus,
} from '@zemp/shared';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock,
  Equal,
  TriangleAlert,
  ChevronsUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'blocked';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink-secondary',
  primary: 'bg-primary-soft text-primary-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
  blocked: 'bg-blocked-soft text-blocked-ink',
};

interface BadgeProps {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

/** Pill badge — always icon + text, never colour alone (Frontend.md §34, §141). */
export function Badge({ tone = 'neutral', icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS: Record<TaskStatus, { tone: Tone; icon: LucideIcon }> = {
  TODO: { tone: 'neutral', icon: CircleDashed },
  IN_PROGRESS: { tone: 'primary', icon: CircleDot },
  BLOCKED: { tone: 'blocked', icon: Ban },
  COMPLETED: { tone: 'success', icon: CircleCheck },
  CANCELLED: { tone: 'neutral', icon: CircleX },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge tone={STATUS[status].tone} icon={STATUS[status].icon} className={className}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

const PRIORITY: Record<TaskPriority, { className: string; icon: LucideIcon }> = {
  LOW: { className: 'text-ink-muted', icon: ArrowDown },
  MEDIUM: { className: 'text-info-ink', icon: Equal },
  HIGH: { className: 'text-warning-ink', icon: ArrowUp },
  URGENT: { className: 'text-danger-ink', icon: ChevronsUp },
};

/** Quieter than status: an icon and a label, no pill (Frontend.md §35). */
export function PriorityLabel({ priority, className }: { priority: TaskPriority; className?: string }) {
  const { className: tone, icon: Icon } = PRIORITY[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 text-meta font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

const RISK: Record<RiskLevel, { tone: Tone; icon: LucideIcon }> = {
  ON_TRACK: { tone: 'success', icon: CircleCheck },
  AT_RISK: { tone: 'warning', icon: TriangleAlert },
  OVERDUE: { tone: 'danger', icon: Clock },
  COMPLETED: { tone: 'success', icon: CircleCheck },
};

export function RiskBadge({ risk, className }: { risk: RiskLevel | null; className?: string }) {
  if (!risk) return <span className="text-meta text-ink-muted">—</span>;
  return (
    <Badge tone={RISK[risk].tone} icon={RISK[risk].icon} className={cn('uppercase tracking-wide', className)}>
      {RISK_LABELS[risk]}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'danger'} icon={active ? CircleCheck : CircleX}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}
