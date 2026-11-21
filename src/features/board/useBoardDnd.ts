/**
 * Board drag state (DESIGN §5.3).
 *
 * During a drag the board renders a local `Layout` (card ids per column) instead of the query
 * data: cross-column moves happen in `onDragOver` so cards reflow live, and the change is
 * persisted once in `onDragEnd`. After a drop the final layout is held until the task list
 * re-renders with the optimistic move, so the card never flickers back for a frame.
 */
import {
  KeyboardSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_BY_VALUE, STATUSES, type Status } from '@/lib/domain';
import { queryKeys } from '@/lib/queryKeys';
import type { MoveInput } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import {
  BoardPointerSensor,
  BoardTouchSensor,
  boardKeyboardCoordinates,
  POINTER_ACTIVATION,
  TOUCH_ACTIVATION,
  detectCollisions,
  type CollisionTracking,
  findColumn,
  keyboardCodes,
  statusFromColumnId,
  type Layout,
} from './dnd';

type Columns = Record<Status, Task[]>;

type DragState = {
  /** Card being dragged; null once dropped while the final layout is held. */
  activeId: string | null;
  layout: Layout;
  origin: { status: Status; index: number };
  /** The columns the layout was derived from; a new value means the cache caught up. */
  basis: Columns;
};

function toLayout(columns: Columns): Layout {
  return Object.fromEntries(
    STATUSES.map((s) => [s.value, columns[s.value].map((t) => t.id)]),
  ) as Layout;
}

export function useBoardDnd({
  columns,
  tasksById,
  moveTask,
}: {
  columns: Columns;
  tasksById: Map<string, Task>;
  moveTask: (input: MoveInput) => boolean;
}) {
  const queryClient = useQueryClient();
  const [drag, setDrag] = useState<DragState | null>(null);

  // A held (post-drop) layout is only valid until the columns change; after that it is ignored
  // and simply replaced by the next drag.
  const current = drag && (drag.activeId !== null || drag.basis === columns) ? drag : null;

  // Refs so the dnd-kit callbacks stay stable and read the latest values synchronously.
  const dragRef = useRef<DragState | null>(null);
  const tracking = useRef<CollisionTracking>({
    layout: null,
    lastOverId: null,
    movedToNewColumn: false,
  });
  const columnsRef = useRef(columns);
  const tasksRef = useRef(tasksById);
  const moveRef = useRef(moveTask);
  useEffect(() => {
    columnsRef.current = columns;
    tasksRef.current = tasksById;
    moveRef.current = moveTask;
  });

  const crossedThisEvent = useRef(false);

  const commit = useCallback((next: DragState | null) => {
    dragRef.current = next;
    tracking.current.layout = next?.activeId ? next.layout : null;
    setDrag(next);
  }, []);

  const sensors = useSensors(
    useSensor(BoardPointerSensor, { activationConstraint: POINTER_ACTIVATION }),
    useSensor(BoardTouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates, keyboardCodes }),
  );

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => detectCollisions(args, tracking.current),
    [],
  );

  const onDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      // A refetch landing mid-drag must not fight the local layout.
      void queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const layout = toLayout(columnsRef.current);
      const status = findColumn(layout, active.id);
      if (!status) return;
      tracking.current.lastOverId = active.id;
      commit({
        activeId: String(active.id),
        layout,
        origin: { status, index: layout[status].indexOf(String(active.id)) },
        basis: columnsRef.current,
      });
    },
    [commit, queryClient],
  );

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      crossedThisEvent.current = false;
      const state = dragRef.current;
      if (!over || !state?.activeId) return;
      const from = findColumn(state.layout, active.id);
      const to = findColumn(state.layout, over.id);
      if (!from || !to || from === to) return;

      const target = state.layout[to];
      let index = target.length;
      if (!statusFromColumnId(over.id)) {
        const overIndex = target.indexOf(String(over.id));
        const translated = active.rect.current.translated;
        const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2;
        if (overIndex >= 0) index = overIndex + (below ? 1 : 0);
      }

      tracking.current.movedToNewColumn = true;
      requestAnimationFrame(() => {
        tracking.current.movedToNewColumn = false;
      });
      crossedThisEvent.current = true;
      commit({
        ...state,
        layout: {
          ...state.layout,
          [from]: state.layout[from].filter((id) => id !== active.id),
          [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
        },
      });
    },
    [commit],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const state = dragRef.current;
      const id = String(active.id);
      const column = state ? findColumn(state.layout, id) : null;
      if (!state || !over || !column) {
        commit(null);
        return;
      }

      let list = state.layout[column];
      if (findColumn(state.layout, over.id) === column && !statusFromColumnId(over.id)) {
        const from = list.indexOf(id);
        const to = list.indexOf(String(over.id));
        if (from >= 0 && to >= 0 && from !== to) list = arrayMove(list, from, to);
      }
      const index = list.indexOf(id);
      if (column === state.origin.status && index === state.origin.index) {
        commit(null);
        return;
      }

      const moved = moveRef.current({
        id,
        status: column,
        afterId: list[index - 1] ?? null,
        beforeId: list[index + 1] ?? null,
      });
      commit(
        moved
          ? {
              ...state,
              activeId: null,
              layout: { ...state.layout, [column]: list },
              basis: columnsRef.current,
            }
          : null,
      );
    },
    [commit],
  );

  const onDragCancel = useCallback(() => commit(null), [commit]);

  const announcements = useMemo<Announcements>(() => {
    const title = (id: UniqueIdentifier) => tasksRef.current.get(String(id))?.title ?? 'task';
    const place = (activeId: UniqueIdentifier, overId: UniqueIdentifier | undefined) => {
      const layout = dragRef.current?.layout;
      if (!layout || overId === undefined) return null;
      const status = findColumn(layout, overId);
      if (!status) return null;
      const ids = layout[status];
      const anchor =
        crossedThisEvent.current || statusFromColumnId(overId) ? activeId : String(overId);
      const index = Math.max(0, ids.indexOf(String(anchor)));
      const count = ids.includes(String(activeId)) ? ids.length : ids.length + 1;
      return `${STATUS_BY_VALUE[status].label}, position ${index + 1} of ${count}`;
    };
    return {
      onDragStart: ({ active }) => {
        const where = place(active.id, active.id);
        return `Picked up ${title(active.id)}${where ? ` in ${where}` : ''}. Use the arrow keys to move, Space to drop, Escape to cancel.`;
      },
      onDragOver: ({ active, over }) => {
        // Fired right after pick-up with the card over itself: keep "Picked up…" audible.
        if (over?.id === active.id && !crossedThisEvent.current) return undefined;
        const where = place(active.id, over?.id);
        return where
          ? `Moved ${title(active.id)} to ${where}.`
          : `${title(active.id)} is not over a column.`;
      },
      onDragEnd: ({ active }) => {
        // By now the held layout is final (or cleared when nothing changed).
        const where = place(active.id, active.id);
        return where
          ? `Dropped ${title(active.id)} in ${where}.`
          : `Dropped ${title(active.id)} back in its place.`;
      },
      onDragCancel: ({ active }) => `Cancelled. ${title(active.id)} was returned to its place.`,
    };
  }, []);

  /** Columns to render: the live layout during a drag, the query data otherwise. */
  const visibleColumns = useMemo<Columns>(() => {
    if (!current) return columns;
    return Object.fromEntries(
      STATUSES.map((s) => [
        s.value,
        current.layout[s.value]
          .map((id) => tasksById.get(id))
          .filter((t): t is Task => t !== undefined),
      ]),
    ) as Columns;
  }, [current, columns, tasksById]);

  const activeId = current?.activeId ?? null;
  const overStatus = activeId && current ? findColumn(current.layout, activeId) : null;

  return {
    sensors,
    collisionDetection,
    announcements,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDragCancel,
    columns: visibleColumns,
    activeTask: activeId ? (tasksById.get(activeId) ?? null) : null,
    overStatus,
    isDragging: activeId !== null,
  };
}
