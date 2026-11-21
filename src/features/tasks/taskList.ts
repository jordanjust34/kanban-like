/**
 * Pure helpers over the cached task list. The optimistic mutations in `api.ts` are built from
 * these, so the interesting logic is unit-tested without a network or a QueryClient.
 * Every helper returns a new array sorted by position and never mutates its input.
 */
import { STATUSES, type Status } from '@/lib/domain';
import { needsRenumber, positionBetween, renumber } from './position';
import type { Task } from './types';

/** A position (and optionally status) change for one task. */
export type TaskPatch = { id: string; position: number; status?: Status };

export type MoveInput = {
  id: string;
  status: Status;
  /** The card that should end up directly above the moved card (`null` = no constraint). */
  afterId?: string | null;
  /** The card that should end up directly below the moved card (`null` = no constraint). */
  beforeId?: string | null;
};

/** Optimistic rows get a `temp-` id until the insert returns the real one. */
const TEMP_PREFIX = 'temp-';

export function makeTempId(): string {
  return `${TEMP_PREFIX}${crypto.randomUUID()}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

function compareTasks(a: Task, b: Task): number {
  return (
    a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
}

export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}

/** Cards of one column in board order, optionally leaving one card out. */
export function columnTasks(tasks: readonly Task[], status: Status, excludeId?: string): Task[] {
  return sortTasks(tasks.filter((t) => t.status === status && t.id !== excludeId));
}

export function groupByStatus(tasks: readonly Task[]): Record<Status, Task[]> {
  const groups = Object.fromEntries(STATUSES.map((s) => [s.value, [] as Task[]])) as Record<
    Status,
    Task[]
  >;
  for (const task of sortTasks(tasks)) groups[task.status].push(task);
  return groups;
}

/** Position for a new card at the top of `status`. */
export function topPosition(tasks: readonly Task[], status: Status): number {
  return positionBetween(undefined, columnTasks(tasks, status)[0]?.position);
}

/** Adds the task, or replaces the row with the same id. */
export function upsertTask(tasks: readonly Task[], task: Task): Task[] {
  return sortTasks([...tasks.filter((t) => t.id !== task.id), task]);
}

/** Upserts several rows (used to roll back to a snapshot of just the touched tasks). */
export function restoreTasks(tasks: readonly Task[], previous: readonly Task[]): Task[] {
  const ids = new Set(previous.map((t) => t.id));
  return sortTasks([...tasks.filter((t) => !ids.has(t.id)), ...previous]);
}

export function removeTask(tasks: readonly Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

/** Swaps an optimistic row (temp id) for the row the server returned. */
export function replaceTask(tasks: readonly Task[], id: string, next: Task): Task[] {
  return sortTasks([...tasks.filter((t) => t.id !== id && t.id !== next.id), next]);
}

export function patchTask(tasks: readonly Task[], id: string, patch: Partial<Task>): Task[] {
  return sortTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch, id } : t)));
}

export function applyPatches(tasks: readonly Task[], patches: readonly TaskPatch[]): Task[] {
  const byId = new Map(patches.map((p) => [p.id, p]));
  return sortTasks(
    tasks.map((t) => {
      const p = byId.get(t.id);
      return p ? { ...t, position: p.position, status: p.status ?? t.status } : t;
    }),
  );
}

/**
 * Works out the writes for moving a card next to the given neighbours.
 * Returns `null` when the card would land where it already is (no request needed).
 * The first patch is always the moved card (with its status); any others renumber its new column.
 *
 * Neighbours are ids rather than an index so the caller can pass the cards it *sees*
 * (e.g. a filtered column): the card goes right after `afterId`, else right before `beforeId`,
 * else to the end of the column.
 */
export function planMove(tasks: readonly Task[], input: MoveInput): TaskPatch[] | null {
  const task = tasks.find((t) => t.id === input.id);
  if (!task) return null;

  const column = columnTasks(tasks, input.status, task.id);
  const afterIndex = input.afterId ? column.findIndex((t) => t.id === input.afterId) : -1;
  const beforeIndex = input.beforeId ? column.findIndex((t) => t.id === input.beforeId) : -1;
  const index = afterIndex >= 0 ? afterIndex + 1 : beforeIndex >= 0 ? beforeIndex : column.length;

  const prev = column[index - 1];
  const next = column[index];

  if (task.status === input.status) {
    const current = columnTasks(tasks, task.status);
    const at = current.findIndex((t) => t.id === task.id);
    if (current[at - 1]?.id === prev?.id && current[at + 1]?.id === next?.id) return null;
  }

  if (!needsRenumber(prev?.position, next?.position)) {
    return [
      {
        id: task.id,
        status: input.status,
        position: positionBetween(prev?.position, next?.position),
      },
    ];
  }

  const ordered = [...column.slice(0, index), task, ...column.slice(index)];
  const positions = renumber(ordered);
  const moved = positions.find((p) => p.id === task.id);
  const others = positions.filter(
    (p) => p.id !== task.id && column.find((t) => t.id === p.id)?.position !== p.position,
  );
  return [{ id: task.id, status: input.status, position: moved?.position ?? 0 }, ...others];
}
