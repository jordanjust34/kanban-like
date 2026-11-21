import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Keyboard key hint, e.g. `<Kbd>/</Kbd>`. */
export function Kbd({ className, ...rest }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-border bg-card px-1',
        'font-sans text-[11px] leading-none font-medium text-subtle shadow-[0_1px_0_var(--border)]',
        className,
      )}
      {...rest}
    />
  );
}
