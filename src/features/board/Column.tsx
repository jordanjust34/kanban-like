import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ClipboardList, Plus } from 'lucide-react';
import { memo, useMemo, type CSSProperties } from 'react';
import { Button, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { STATUSES } from '@/lib/domain';
import { QuickAdd } from '@/features/tasks/QuickAdd';
import type { Task } from '@/features/tasks/types';
import { columnDroppableId } from './dnd';
import { SortableTaskCard } from './TaskCard';

type StatusInfo = (typeof STATUSES)[number];

export type ColumnProps = {
  status: StatusInfo;
  tasks: Task[];
  /** A card is being dragged anywhere on the board. */
  isDragging: boolean;
  /** The dragged card is currently in this column. */
  isOver: boolean;
  /** Filters are hiding cards (changes the empty hint). */
  isFiltering: boolean;
  /** Brand-new board: To Do shows the first-run prompt. */
  showFirstRun: boolean;
  quickAddOpen: boolean;
  onOpenQuickAdd: (status: StatusInfo['value']) => void;
  onCloseQuickAdd: () => void;
  onCreate: (status: StatusInfo['value'], title: string) => void;
};

function FirstRunPrompt({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-card px-5 py-7 text-center shadow-card ring-1 ring-black/[0.04]">
      <div
        aria-hidden
        className="mb-3.5 flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-text"
      >
        <ClipboardList className="size-5" />
      </div>
      <h3 className="text-[15px] leading-6 font-semibold tracking-[-0.01em] text-primary">
        Plan your first task
      </h3>
      <p className="mt-1 text-body text-secondary">
        Add what's on your plate, then drag cards across the board as work moves along.
      </p>
      <Button variant="primary" className="mt-4" leadingIcon={<Plus />} onClick={onStart}>
        Create a task
      </Button>
      <p className="mt-3 hidden items-center gap-1.5 text-meta text-subtle sm:flex">
        or press <Kbd>C</Kbd>
      </p>
    </div>
  );
}

function EmptyHint({ isDragging, isFiltering }: { isDragging: boolean; isFiltering: boolean }) {
  return (
    <div
      className={cn(
        'flex h-24 shrink-0 items-center justify-center rounded-md border border-dashed text-meta transition-colors duration-150',
        isDragging
          ? 'border-(--status-accent) bg-card/50 text-secondary'
          : 'border-border-strong text-subtle',
      )}
    >
      {isDragging ? 'Drop here' : isFiltering ? 'No matching tasks' : 'No tasks'}
    </div>
  );
}

/** One board column (DESIGN §7.1): header, optional quick-add, sortable card list. */
export const Column = memo(function Column({
  status,
  tasks,
  isDragging,
  isOver,
  isFiltering,
  showFirstRun,
  quickAddOpen,
  onOpenQuickAdd,
  onCloseQuickAdd,
  onCreate,
}: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: columnDroppableId(status.value),
    data: { type: 'column', status: status.value },
  });
  const ids = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const headingId = `column-${status.value}`;
  const count = tasks.length;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-status={status.value}
      className="board-column relative"
      style={{ '--status-accent': status.accent } as CSSProperties}
    >
      {/* Tint + hairline while the dragged card is in this column. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 rounded-lg bg-(--status-accent) transition-opacity duration-200 ease-out',
          'shadow-[inset_0_0_0_1.5px_var(--status-accent)]',
          isOver ? 'opacity-[0.07]' : 'opacity-0',
        )}
      />

      <header className="relative flex h-11 shrink-0 items-center gap-2 pt-0.5 pr-1.5 pl-3">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: status.accent }}
        />
        <h2 id={headingId} className="truncate text-column-header text-primary">
          {status.label}
        </h2>
        <span
          className="text-meta text-subtle tabular-nums"
          aria-label={`${count} ${count === 1 ? 'task' : 'tasks'}`}
        >
          {count}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          icon={<Plus />}
          aria-label={`Add task to ${status.label}`}
          aria-expanded={quickAddOpen}
          onClick={() => onOpenQuickAdd(status.value)}
        />
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-2 pb-2 scrollbar-thin">
        {quickAddOpen && (
          <QuickAdd
            status={status.value}
            onCreate={(title) => onCreate(status.value, title)}
            onClose={onCloseQuickAdd}
          />
        )}

        {showFirstRun && !quickAddOpen && count === 0 && (
          <FirstRunPrompt onStart={() => onOpenQuickAdd(status.value)} />
        )}

        <SortableContext id={status.value} items={ids} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {count === 0 && !showFirstRun && !quickAddOpen && (
          <EmptyHint isDragging={isDragging} isFiltering={isFiltering} />
        )}
      </div>
    </section>
  );
});
