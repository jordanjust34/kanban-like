import { SignalHigh, SignalLow, SignalMedium, type LucideIcon } from 'lucide-react';
import { PRIORITIES, type Priority } from '@/lib/domain';
import { cn } from '@/lib/cn';

const STYLE: Record<Priority, { icon: LucideIcon; className: string }> = {
  high: { icon: SignalHigh, className: 'text-danger-text' },
  normal: { icon: SignalMedium, className: 'text-status-in-progress' },
  low: { icon: SignalLow, className: 'text-subtle' },
};

const LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label])) as Record<
  Priority,
  string
>;

/** Signal-bars icon + text, so priority never relies on color alone (NFR-5). */
export function PriorityIndicator({ priority }: { priority: Priority }) {
  const { icon: Icon, className } = STYLE[priority];
  return (
    <span
      className={cn('inline-flex h-5 shrink-0 items-center gap-1 text-meta', className)}
      title={`${LABEL[priority]} priority`}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.5} />
      <span>
        {LABEL[priority]}
        <span className="sr-only"> priority</span>
      </span>
    </span>
  );
}
