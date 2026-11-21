import { AlertTriangle } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useToday } from '@/features/due/useToday';
import { useTasks } from '@/features/tasks/api';
import { deriveStats } from './deriveStats';

function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-meta whitespace-nowrap tabular-nums',
        className ?? 'bg-black/[0.04] text-secondary',
      )}
    >
      {children}
    </span>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-primary">{children}</span>;
}

/**
 * Header summary (DESIGN §7.5): Total · Done (with % and a thin bar) · Overdue (red only when
 * > 0). Derived from the cached, unfiltered task list, so it describes the whole board and
 * updates on the same render as any optimistic change. Nothing while loading or on error: the
 * board shows those states.
 */
export function BoardStats() {
  const { data: tasks, isError } = useTasks();
  const today = useToday();
  const stats = useMemo(() => (tasks ? deriveStats(tasks, today) : null), [tasks, today]);
  if (!stats || isError) return null;

  const { total, done, overdue, percentDone } = stats;
  const hasOverdue = overdue > 0;

  return (
    <div role="group" aria-label="Board summary" className="flex min-w-0 items-center">
      {/* < 640 px: one condensed line, so the header never overflows at 360 px. */}
      <p className="flex items-center gap-1.5 text-meta text-secondary tabular-nums sm:hidden">
        <span>
          <Num>
            {done}/{total}
          </Num>{' '}
          done
        </span>{' '}
        <span aria-hidden className="text-muted">
          ·
        </span>{' '}
        <span className={cn('inline-flex items-center gap-1', hasOverdue && 'text-danger-text')}>
          {hasOverdue && <AlertTriangle aria-hidden className="size-3" strokeWidth={2.25} />}
          <span className={cn('font-semibold', hasOverdue ? 'text-danger-text' : 'text-primary')}>
            {overdue}
          </span>{' '}
          overdue
        </span>
      </p>

      <div className="flex items-center gap-1.5 max-sm:hidden">
        <Pill>
          <Num>{total}</Num> total
        </Pill>

        <Pill>
          <Num>{done}</Num> done <span className="text-subtle">{percentDone}%</span>
          <span
            role="progressbar"
            aria-label="Tasks done"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentDone}
            aria-valuetext={`${done} of ${total} tasks done (${percentDone}%)`}
            className="h-1 w-10 overflow-hidden rounded-full bg-black/[0.08]"
          >
            <span
              className="block h-full rounded-full bg-success transition-[width] duration-300 ease-out"
              style={{ width: `${percentDone}%` }}
            />
          </span>
        </Pill>

        <Pill className={hasOverdue ? 'bg-danger-soft text-danger-text' : undefined}>
          {hasOverdue && <AlertTriangle aria-hidden className="size-3" strokeWidth={2.25} />}
          <span className={cn('font-semibold', hasOverdue ? 'text-danger-text' : 'text-primary')}>
            {overdue}
          </span>{' '}
          overdue
        </Pill>
      </div>
    </div>
  );
}
