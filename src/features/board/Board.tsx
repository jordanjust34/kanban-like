import { DndContext, DragOverlay, MeasuringStrategy } from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardSkeleton } from '@/app/BoardSkeleton';
import { ErrorState } from '@/components/ui';
import { STATUSES, type Status } from '@/lib/domain';
import { NoResults } from '@/features/filters/NoResults';
import { clearFilters } from '@/features/filters/useFilterState';
import { useVisibleTasks } from '@/features/filters/useVisibleTasks';
import { useCreateTask, useDeleteTask, useMoveTask, useTasks } from '@/features/tasks/api';
import { describeError } from '@/features/tasks/errors';
import { groupByStatus } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import { BoardActionsContext, type BoardActions } from './BoardActions';
import { Column } from './Column';
import { dropAnimation } from './dnd';
import { TaskCardBody } from './TaskCard';
import { useBoardDnd } from './useBoardDnd';

const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'To pick up a task, press Space. Use the arrow keys to move it within a column or to another column. Press Space again to drop it, or Escape to cancel. Press Enter to open the task.',
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** True when a key press should not trigger a board shortcut (typing in a field, menus…). */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select, [role="menu"]') !== null)
  );
}

/** The loaded board: four columns, drag and drop, quick-add. */
function BoardView({ tasks }: { tasks: Task[] }) {
  const { visible, isFiltering } = useVisibleTasks(tasks);
  const columns = useMemo(() => groupByStatus(visible), [visible]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const createTask = useCreateTask();
  const moveTask = useMoveTask();
  const deleteTask = useDeleteTask();
  const dnd = useBoardDnd({ columns, tasksById, moveTask });

  const [quickAdd, setQuickAdd] = useState<Status | null>(null);
  const openQuickAdd = useCallback((status: Status) => {
    setQuickAdd(status);
    document
      .querySelector(`[data-status="${status}"]`)
      ?.scrollIntoView?.({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, []);
  const closeQuickAdd = useCallback(() => setQuickAdd(null), []);
  const onCreate = useCallback(
    (status: Status, title: string) => void createTask({ title, status }),
    [createTask],
  );

  // `C` opens quick-add in To Do (DESIGN §5.5).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'c' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      event.preventDefault();
      openQuickAdd('todo');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openQuickAdd]);

  const actions = useMemo<BoardActions>(
    () => ({
      moveToColumn: (task, status) =>
        void moveTask({ id: task.id, status, afterId: null, beforeId: columns[status][0]?.id }),
      deleteTask,
    }),
    [moveTask, deleteTask, columns],
  );

  const isEmptyBoard = tasks.length === 0;
  if (isFiltering && visible.length === 0) return <NoResults onClear={clearFilters} />;

  return (
    <BoardActionsContext.Provider value={actions}>
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={dnd.collisionDetection}
        measuring={MEASURING}
        onDragStart={dnd.onDragStart}
        onDragOver={dnd.onDragOver}
        onDragEnd={dnd.onDragEnd}
        onDragCancel={dnd.onDragCancel}
        accessibility={{
          announcements: dnd.announcements,
          screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
        }}
      >
        <div className="board-scroller" data-dragging={dnd.isDragging || undefined}>
          {STATUSES.map((status) => (
            <Column
              key={status.value}
              status={status}
              tasks={dnd.columns[status.value]}
              isDragging={dnd.isDragging}
              isOver={dnd.overStatus === status.value}
              isFiltering={isFiltering}
              showFirstRun={isEmptyBoard && status.value === 'todo'}
              quickAddOpen={quickAdd === status.value}
              onOpenQuickAdd={openQuickAdd}
              onCloseQuickAdd={closeQuickAdd}
              onCreate={onCreate}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={prefersReducedMotion() ? null : dropAnimation}>
          {dnd.activeTask ? <TaskCardBody task={dnd.activeTask} variant="overlay" /> : null}
        </DragOverlay>
      </DndContext>
    </BoardActionsContext.Provider>
  );
}

/** Board area (FR-S1/S2): skeleton while loading, a retryable error, or the board. */
export function Board() {
  const query = useTasks();

  if (query.data) return <BoardView tasks={query.data} />;

  if (query.isError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <ErrorState
          title="Couldn't load your board"
          reason={describeError(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    );
  }

  return <BoardSkeleton />;
}
