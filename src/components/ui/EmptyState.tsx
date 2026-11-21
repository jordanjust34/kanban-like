import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type EmptyStateProps = {
  /** Decorative icon (e.g. a lucide icon). Rendered in a soft tile. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary call to action, usually a `<Button>`. */
  action?: ReactNode;
  className?: string;
};

/** Centered, friendly placeholder for "nothing here yet" moments. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center px-6 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className="mb-4 flex size-11 items-center justify-center rounded-lg border border-border bg-card text-subtle shadow-card [&_svg]:size-5"
        >
          {icon}
        </div>
      )}
      <h2 className="text-[15px] leading-6 font-semibold tracking-[-0.01em] text-primary">
        {title}
      </h2>
      {description && <p className="mt-1 text-body text-secondary">{description}</p>}
      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
    </div>
  );
}
