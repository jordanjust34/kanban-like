import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { fieldClass } from './field';

export type InputProps = ComponentProps<'input'>;

/** Single-line text field. Label it with `<label htmlFor>` or `aria-label`. */
export function Input({ className, type = 'text', ...rest }: InputProps) {
  return <input type={type} className={cn(fieldClass, 'h-8 px-2.5', className)} {...rest} />;
}
