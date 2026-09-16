import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { inputClasses } from './Input';

/** Native select: accessible, keyboard- and mobile-friendly without extra JavaScript. */
export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(inputClasses, 'appearance-none truncate pr-9')} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-faint"
      />
    </div>
  );
}
