import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'warning' | 'success';

export type BadgeProps = ComponentProps<'span'> & { tone?: BadgeTone };

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-black/[0.05] text-secondary',
  accent: 'bg-accent-soft text-accent-text',
  danger: 'bg-danger-soft text-danger-text',
  warning: 'bg-warning-soft text-warning-text',
  success: 'bg-success-soft text-success-text',
};

/** Compact meta pill (12/16 medium). Tinted background + AA-contrast text per tone. */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-meta whitespace-nowrap tabular-nums [&_svg]:size-3',
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
