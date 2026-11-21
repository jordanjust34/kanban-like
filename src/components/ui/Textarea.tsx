import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { fieldClass } from './field';

export type TextareaProps = ComponentProps<'textarea'>;

/** Multi-line text field. Body type size so long descriptions stay readable. */
export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(fieldClass, 'min-h-16 resize-y px-2.5 py-2 text-body', className)}
      {...rest}
    />
  );
}
