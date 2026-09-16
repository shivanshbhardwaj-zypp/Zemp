'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 overflow-x-auto border-b border-border-subtle', className)} {...props} />;
}

/** Underlined tabs, coral when active (reference: Employee List / Organization Chart). */
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors duration-150 hover:text-ink data-[state=active]:border-primary data-[state=active]:text-primary-ink',
        className,
      )}
      {...props}
    />
  );
}
