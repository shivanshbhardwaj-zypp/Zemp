'use client';

import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';
import { floatingPanelClasses } from './DropdownMenu';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  sideOffset = 8,
  align = 'end',
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={16}
        className={cn(floatingPanelClasses, 'outline-none', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
