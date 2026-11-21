import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Shimmering placeholder block. Size it with classes; hidden from assistive tech. */
export function Skeleton({ className, ...rest }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-sm', className)} {...rest} />;
}
