import type { CSSProperties } from 'react';
import { STATUSES } from '@/lib/domain';

/**
 * Placeholder board (P1-ui): the four empty column frames at their real sizes, so later
 * phases have a visual baseline. Phase 2 replaces this file with the real board.
 */
export function Board() {
  return (
    <div className="board-scroller">
      {STATUSES.map((status) => (
        <section
          key={status.value}
          aria-labelledby={`column-${status.value}`}
          className="board-column"
          style={{ '--status-accent': status.accent } as CSSProperties}
        >
          <header className="flex h-11 shrink-0 items-center gap-2 px-3 pt-0.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: status.accent }}
            />
            <h2 id={`column-${status.value}`} className="text-column-header text-primary">
              {status.label}
            </h2>
            <span className="text-meta text-subtle tabular-nums" aria-label="0 tasks">
              0
            </span>
          </header>
          <div className="px-2 pb-2">
            <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border-strong text-meta text-subtle">
              No tasks
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
