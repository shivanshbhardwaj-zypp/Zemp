'use client';

import { Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { inputClasses } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}

/** Debounced search so typing doesn't fire a request per keystroke. */
export function SearchInput({ value, onChange, label, placeholder, className }: SearchInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // Adjust state during render rather than in an effect when the caller changes the query.
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft.trim()), 300);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder ?? `${label}…`}
        className={cn(inputClasses, 'pl-10')}
      />
    </div>
  );
}
