import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/ui';
import { STATUSES } from '@/lib/domain';

/** Placeholder cards per column: 2–3 each, varied so it doesn't look like a grid. */
const CARDS_PER_COLUMN = [3, 2, 3, 2] as const;
const TITLE_WIDTHS = ['w-4/5', 'w-3/5', 'w-11/12'] as const;

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="rounded-md bg-card p-3 shadow-card">
      {index % 2 === 0 && <Skeleton className="mb-2.5 h-4 w-14" />}
      <Skeleton className={`h-3.5 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`} />
      {index % 3 === 0 && <Skeleton className="mt-2 h-3.5 w-2/5" />}
      <div className="mt-3.5 flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="ml-auto size-5 rounded-full" />
      </div>
    </div>
  );
}

/** First-load state (DESIGN §7.6): the four columns with shimmering cards. */
export function BoardSkeleton() {
  return (
    <div className="board-scroller" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your board…</span>
      {STATUSES.map((status, col) => (
        <div
          key={status.value}
          aria-hidden
          className="board-column"
          style={{ '--status-accent': status.accent } as CSSProperties}
        >
          <div className="flex h-11 shrink-0 items-center gap-2 px-3 pt-0.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: status.accent }} />
            <span className="text-column-header text-subtle">{status.label}</span>
            <Skeleton className="h-3 w-4" />
          </div>
          <div className="flex flex-col gap-2 px-2 pb-2">
            {Array.from({ length: CARDS_PER_COLUMN[col] ?? 2 }, (_, i) => (
              <SkeletonCard key={i} index={i + col} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
