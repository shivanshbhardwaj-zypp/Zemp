'use client';

import type { ProgressPoint } from '@zemp/shared';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCount, formatDayKey, formatPercent } from '@/lib/format';

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; payload?: unknown }>;
}

const tick = { fill: 'var(--color-ink-muted)', fontSize: 12 };

function CompletionTooltip({ active, payload, label }: TooltipProps) {
  const point = payload?.[0]?.payload as ProgressPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-meta shadow-elevated">
      <p className="mb-1 font-semibold text-ink">{formatDayKey(String(label), { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      <p className="text-ink-secondary">
        Completed: <span className="font-semibold text-ink tabular">{formatCount(point.completed)}</span>
      </p>
      <p className="text-ink-secondary">
        Total: <span className="font-semibold text-ink tabular">{formatCount(point.total)}</span>
      </p>
      <p className="text-ink-secondary">
        Progress: <span className="font-semibold text-ink tabular">{formatPercent(point.completionRate, 2)}</span>
      </p>
    </div>
  );
}

/** One series — completion of the scoped workload per day — so no legend box is needed. */
export default function CompletionChart({ data }: { data: ProgressPoint[] }) {
  return (
    <div className="h-56" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tick} tickFormatter={(key: string) => formatDayKey(key, { month: 'short', day: 'numeric' })} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={tick} width={48} />
          <Tooltip content={CompletionTooltip} cursor={{ stroke: 'var(--color-border-strong)' }} />
          <Line
            type="monotone"
            dataKey="completionRate"
            stroke="var(--color-primary-strong)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)', fill: 'var(--color-primary-strong)' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
