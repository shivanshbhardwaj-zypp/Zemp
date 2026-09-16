import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}

type Crumb = { label: string; href?: string };

/** Only where hierarchy helps, e.g. "Employees / Aarav Shah" (Frontend.md §164). */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-meta text-ink-muted">
        {items.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden />}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-ink hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[40ch] truncate text-ink-secondary">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Title left, primary action right on desktop; stacked on mobile (Frontend.md §163–164). */
export function PageHeader({ title, description, actions, breadcrumbs, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <div className="mt-1 text-sm text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
