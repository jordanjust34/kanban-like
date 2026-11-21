import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fieldClass } from './field';

export type SelectProps = ComponentProps<'select'>;

/** Native `<select>` with the field look and a custom chevron. Pass `<option>`s as children. */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(fieldClass, 'h-8 appearance-none pr-8 pl-2.5')} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle"
      />
    </div>
  );
}
