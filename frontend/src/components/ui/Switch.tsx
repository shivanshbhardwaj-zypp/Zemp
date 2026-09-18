'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

/** Coral when on, matching the Tabs/Button active state (Frontend.md palette). */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-track transition-colors duration-150 data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-1 rounded-full bg-surface shadow-card transition-transform duration-150 data-[state=checked]:translate-x-5" />
    </SwitchPrimitive.Root>
  );
}
