/**
 * Drag-and-drop building blocks for the board (DESIGN §5.3): sensors, ids, collision detection
 * and the drop animation. Board state lives in `useBoardDnd`.
 */
import {
  KeyboardCode,
  PointerSensor,
  TouchSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { STATUSES, isStatus, type Status } from '@/lib/domain';

/** Ordered card ids per column: the board's layout while a drag is in progress. */
export type Layout = Record<Status, string[]>;

const COLUMN_PREFIX = 'column:';

export const columnDroppableId = (status: Status) => `${COLUMN_PREFIX}${status}`;

export function statusFromColumnId(id: UniqueIdentifier): Status | null {
  const value = String(id);
  if (!value.startsWith(COLUMN_PREFIX)) return null;
  const status = value.slice(COLUMN_PREFIX.length);
  return isStatus(status) ? status : null;
}

/** Column that contains `id` (a card id or a column droppable id). */
export function findColumn(layout: Layout, id: UniqueIdentifier): Status | null {
  const column = statusFromColumnId(id);
  if (column) return column;
  for (const [status, ids] of Object.entries(layout) as [Status, string[]][]) {
    if (ids.includes(String(id))) return status;
  }
  return null;
}

/** Controls inside a card (the "⋯" menu) must never start a drag. */
function startsOnControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('button, a, input, textarea, select, [role="menuitem"]') !== null
  );
}

/**
 * Mouse / pen only. Touch input goes through `BoardTouchSensor` (long-press), otherwise a
 * finger scrolling a column would start a drag after 4 px.
 */
export class BoardPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent) =>
        event.isPrimary &&
        event.button === 0 &&
        event.pointerType !== 'touch' &&
        !startsOnControl(event.target),
    },
  ];
}

export class BoardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent: event }: ReactTouchEvent) =>
        event.touches.length <= 1 && !startsOnControl(event.target),
    },
  ];
}

/** Space picks up and drops; Enter is left free to open the card. */
export const keyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter],
};

/** Sortable container (= column status) a droppable currently belongs to. */
function containerOf(data: Record<string, unknown> | undefined): string | null {
  const sortable = data?.sortable;
  if (typeof sortable !== 'object' || sortable === null || !('containerId' in sortable)) {
    return null;
  }
  return String(sortable.containerId);
}

/** Height of the column header, so a card dropped into an empty column lands below it. */
const COLUMN_HEADER_HEIGHT = 44;

/**
 * Keyboard moves. Up / Down reorder within the column (dnd-kit's sortable default).
 * Left / Right jump to the adjacent column, next to the card at the nearest height, or to the
 * top of an empty column. The stock getter isn't multi-container aware and can pick a sibling
 * in the same column.
 */
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const right = event.code === KeyboardCode.Right;
  if (!right && event.code !== KeyboardCode.Left) return sortableKeyboardCoordinates(event, args);
  event.preventDefault();

  const { active, collisionRect, droppableRects, droppableContainers } = args.context;
  if (!active || !collisionRect) return undefined;
  const index = STATUSES.findIndex((s) => s.value === containerOf(active.data.current));
  const target = index >= 0 ? STATUSES[index + (right ? 1 : -1)] : undefined;
  if (!target) return undefined;

  const centerY = collisionRect.top + collisionRect.height / 2;
  let best: { left: number; top: number } | null = null;
  let bestDistance = Infinity;
  for (const container of droppableContainers.getEnabled()) {
    if (container.id === active.id || containerOf(container.data.current) !== target.value) {
      continue;
    }
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const distance = Math.abs(rect.top + rect.height / 2 - centerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = rect;
    }
  }
  if (best) return { x: best.left, y: best.top };

  const column = droppableRects.get(columnDroppableId(target.value));
  return column ? { x: column.left + 8, y: column.top + COLUMN_HEADER_HEIGHT } : undefined;
};

export const POINTER_ACTIVATION = { distance: 4 };
export const TOUCH_ACTIVATION = { delay: 200, tolerance: 5 };

/** Mutable tracking shared by the collision detection and the drag handlers. */
export type CollisionTracking = {
  layout: Layout | null;
  lastOverId: UniqueIdentifier | null;
  movedToNewColumn: boolean;
};

/**
 * Multi-container collision detection (the dnd-kit "multiple containers" recipe):
 * pointer-within for pointer drags, rect intersection for keyboard drags (no pointer).
 * When the hit is a column that has cards, it resolves to the closest card inside it, so the
 * live reflow inserts next to a real neighbour. Remembers the last hit to avoid flicker while
 * cards are moving between columns.
 */
export function detectCollisions(
  args: Parameters<CollisionDetection>[0],
  state: CollisionTracking,
): ReturnType<CollisionDetection> {
  // Pointer drags only ever target what is under the pointer. In the gutter between columns
  // they keep the last target: falling back to rect overlap there makes the card bounce between
  // two columns, because moving it changes the column heights and so the overlap ratios.
  // Keyboard drags have no pointer and use the overlap of the moved card's rect.
  const hits = args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
  let overId = getFirstCollision(hits, 'id');

  if (overId != null && state.layout) {
    const column = statusFromColumnId(overId);
    const ids = column ? state.layout[column] : null;
    if (ids && ids.length > 0) {
      overId =
        closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.id !== overId && ids.includes(String(c.id)),
          ),
        })[0]?.id ?? overId;
    }
    state.lastOverId = overId;
    return [{ id: overId }];
  }

  if (state.movedToNewColumn) state.lastOverId = args.active.id;
  return state.lastOverId != null ? [{ id: state.lastOverId }] : [];
}

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * ~200 ms ease-out settle. While the overlay flies to the slot it also loses its tilt and
 * lifted shadow, so it lands flat instead of snapping.
 */
export const dropAnimation: DropAnimation = {
  duration: 200,
  easing: EASE_OUT,
  sideEffects: ({ active, dragOverlay }) => {
    active.node.style.opacity = '0';
    const card = dragOverlay.node.querySelector<HTMLElement>('[data-overlay-card]');
    if (card) {
      card.style.transition = `transform 200ms ${EASE_OUT}, box-shadow 200ms ${EASE_OUT}`;
      card.style.transform = 'none';
      card.style.boxShadow = 'var(--elevation-card)';
    }
    return () => {
      active.node.style.opacity = '';
    };
  },
};
