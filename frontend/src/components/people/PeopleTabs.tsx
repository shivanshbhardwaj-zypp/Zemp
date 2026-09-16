'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/employees', label: 'Employees' },
  { href: '/organization', label: 'Organization' },
];

/** "Employee List | Organization Chart" from the reference, as navigation links. */
export function PeopleTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="People views" className="mb-6 flex gap-1 border-b border-border-subtle">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-150',
              active ? 'border-primary text-primary-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
