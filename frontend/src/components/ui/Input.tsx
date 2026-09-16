import { cn } from '@/lib/cn';

export const inputClasses = cn(
  'h-10 w-full min-w-0 rounded-control border border-border-input bg-surface px-3 text-sm text-ink',
  'transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-ink-faint',
  'focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-soft focus-visible:outline-none',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger-soft',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-disabled',
);

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputClasses, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
}
