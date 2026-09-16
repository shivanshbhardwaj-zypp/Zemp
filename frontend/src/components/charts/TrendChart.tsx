'use client';

import type { DailyTrendPoint } from '@zemp/shared';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDayKey } from '@/lib/format';

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; payload?: unknown }>;
}

/** Validated pair (dataviz validator, light surface): completed = primary-strong, assigned = info. */
const SERIES = [
  { key: 'assigned', label: 'Assigned', color: 'var(--color-info)' },
  { key: 'completed', label: 'Completed', color: 'var(--color-primary-strong)' },
] as const;

const tick = { fill: 'var(--color-ink-muted)', fontSize: 12 };

function TrendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border-subtle bg-surface px-3 py-2 text-meta shadow-elevated">
      <p className="mb-1 font-semibold text-ink">{formatDayKey(String(label), { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-6 text-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
          <span className="font-semibold text-ink tabular">{String(payload.find((p) => p.dataKey === s.key)?.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

/** Tasks assigned and completed per day, with a table alternative for screen readers (Frontend.md §76, §178). */
export default function TrendChart({ data }: { data: DailyTrendPoint[] }) {
  return (
    <figure>
      <ul className="mb-3 flex gap-4 text-meta text-ink-secondary" aria-hidden>
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-xs" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border-subtle)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={tick} tickFormatter={(key: string) => formatDayKey(key, { weekday: 'short' })} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={tick} width={40} />
            <Tooltip content={TrendTooltip} cursor={{ fill: 'var(--color-surface-row)' }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Tasks assigned and completed per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Assigned</th>
            <th scope="col">Completed</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDayKey(point.date)}</th>
              <td>{point.assigned}</td>
              <td>{point.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
