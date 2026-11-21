import type { ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export type ErrorStateProps = {
  title: string;
  /** Short, human reason (e.g. the error message). */
  reason?: ReactNode;
  onRetry?: () => void;
  /** True while a retry is in flight: the button shows a spinner. */
  retrying?: boolean;
  /** Overrides the default warning icon. */
  icon?: ReactNode;
  className?: string;
};

/** Centered failure state with a Retry action. Announced politely to screen readers. */
export function ErrorState({
  title,
  reason,
  onRetry,
  retrying = false,
  icon = <AlertTriangle />,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center px-6 py-10 text-center',
        className,
      )}
    >
      <div
        aria-hidden
        className="mb-4 flex size-11 items-center justify-center rounded-lg bg-danger-soft text-danger-text [&_svg]:size-5"
      >
        {icon}
      </div>
      <h2 className="text-[15px] leading-6 font-semibold tracking-[-0.01em] text-primary">
        {title}
      </h2>
      {reason && <p className="mt-1 text-body break-words text-secondary">{reason}</p>}
      {onRetry && (
        <Button
          className="mt-5"
          variant="secondary"
          onClick={onRetry}
          loading={retrying}
          leadingIcon={<RotateCw />}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
