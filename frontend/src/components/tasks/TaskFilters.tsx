'use client';

import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type ListTasksQuery,
} from '@zemp/shared';
import { SlidersHorizontal, X } from 'lucide-react';
import { useId, useState } from 'react';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Sheet, SheetContent } from '@/components/ui/Sheet';
import { useTeamOptions } from '@/hooks/useTeams';
import type { ParamUpdates } from '@/hooks/useUrlParams';

interface TaskFiltersProps {
  query: ListTasksQuery;
  onChange: (updates: ParamUpdates) => void;
  showTeam: boolean;
}

type FilterKey = 'status' | 'priority' | 'teamId' | 'deadline';
type Draft = Record<FilterKey, string>;

const OPEN = 'TODO,IN_PROGRESS,BLOCKED';

function toDraft(query: ListTasksQuery): Draft {
  return {
    status: query.status?.join(',') ?? '',
    priority: query.priority?.join(',') ?? '',
    teamId: query.teamId ?? '',
    deadline: query.deadline ?? '',
  };
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = useId();
  const known = options.some((o) => o.value === value);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="sr-only max-md:not-sr-only max-md:text-sm max-md:font-medium max-md:text-ink">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="md:w-44 [&_select]:md:h-9">
        {!known && <option value={value}>Custom selection</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Compact filter bar; a filter drawer with Clear all / Apply on phones (Frontend.md §77–78). */
export function TaskFilters({ query, onChange, showTeam }: TaskFiltersProps) {
  const teams = useTeamOptions(showTeam);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(query));

  const current = toDraft(query);
  const activeCount = Object.values(current).filter(Boolean).length + (query.assigneeId ? 1 : 0);

  const options: Record<FilterKey, Array<{ value: string; label: string }>> = {
    status: [
      { value: '', label: 'All statuses' },
      { value: OPEN, label: 'Open' },
      ...TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
    ],
    priority: [{ value: '', label: 'All priorities' }, ...TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))],
    teamId: [{ value: '', label: 'All teams' }, ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))],
    deadline: [
      { value: '', label: 'Any deadline' },
      { value: 'OVERDUE', label: 'Overdue' },
      { value: 'DUE_TODAY', label: 'Due today' },
      { value: 'DUE_TOMORROW', label: 'Due tomorrow' },
      { value: 'UPCOMING', label: 'Upcoming' },
    ],
  };
  const labels: Record<FilterKey, string> = { status: 'Status', priority: 'Priority', teamId: 'Team', deadline: 'Deadline' };
  const keys: FilterKey[] = showTeam ? ['status', 'priority', 'teamId', 'deadline'] : ['status', 'priority', 'deadline'];
  const clearAll = { status: null, priority: null, teamId: null, deadline: null, assigneeId: null, search: null };

  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <div className="flex gap-2">
        <SearchInput
          value={query.search ?? ''}
          onChange={(search) => onChange({ search })}
          label="Search tasks"
          className="flex-1 md:w-72 md:flex-none"
        />
        <Button
          variant="secondary"
          className="md:hidden"
          onClick={() => {
            setDraft(current);
            setDrawerOpen(true);
          }}
        >
          <SlidersHorizontal />
          Filters{activeCount > 0 && ` (${activeCount})`}
        </Button>
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {keys.map((key) => (
          <FilterSelect key={key} label={labels[key]} value={current[key]} options={options[key]} onChange={(value) => onChange({ [key]: value })} />
        ))}
      </div>

      {query.assigneeId && (
        <span className="inline-flex h-8 items-center gap-1 self-start rounded-full bg-primary-soft pr-1 pl-3 text-meta font-medium text-primary-ink md:self-auto">
          {query.assigneeId === 'me' ? 'Assigned to me' : 'One person'}
          <button
            type="button"
            aria-label="Remove person filter"
            onClick={() => onChange({ assigneeId: null })}
            className="flex size-6 items-center justify-center rounded-full hover:bg-primary-muted"
          >
            <X className="size-3.5" />
          </button>
        </span>
      )}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => onChange(clearAll)}>
          Clear filters
        </Button>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" title="Filter tasks">
          <div className="grid gap-4 p-5">
            {keys.map((key) => (
              <FilterSelect
                key={key}
                label={labels[key]}
                value={draft[key]}
                options={options[key]}
                onChange={(value) => setDraft((d) => ({ ...d, [key]: value }))}
              />
            ))}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  onChange(clearAll);
                  setDrawerOpen(false);
                }}
              >
                Clear all
              </Button>
              <Button
                onClick={() => {
                  onChange(draft);
                  setDrawerOpen(false);
                }}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
