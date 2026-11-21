import { AlertTriangle, Calendar, Clock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Task } from '@/features/tasks/types';
import { describeDue, getDueUrgency, type DueTone } from './dueUrgency';
import { useToday } from './useToday';

const TONE: Record<DueTone, { icon: LucideIcon; className: string }> = {
  danger: { icon: AlertTriangle, className: 'bg-danger-soft text-danger-text' },
  warning: { icon: Clock, className: 'bg-warning-soft text-warning-text' },
  neutral: { icon: Calendar, className: 'bg-black/[0.05] text-secondary' },
  done: { icon: Calendar, className: 'bg-black/[0.04] text-subtle line-through' },
};

/**
 * Due-date pill on the card meta row (DESIGN §7.3). Icon + text + a full-date description, so
 * urgency never relies on color alone. Renders nothing without a due date.
 */
export function DueBadge({ task }: { task: Task }) {
  const today = useToday();
  const urgency = getDueUrgency(task.due_date, task.status, today);
  if (!urgency) return null;
  const description = describeDue(task.due_date, task.status, today);
  const { icon: Icon, className } = TONE[urgency.tone];

  return (
    <span
      data-tone={urgency.tone}
      title={description ?? undefined}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-meta whitespace-nowrap tabular-nums',
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2.25} />
      <span aria-hidden>{urgency.label}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}
