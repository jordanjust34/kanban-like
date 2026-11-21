/**
 * Deletes waiting behind the 5 s Undo toast (DESIGN D12).
 *
 * Module-level on purpose: `useTasks` filters these ids out in its `select`, so a refetch during
 * the Undo window (or while the DELETE is in flight) can't bring the card back, whichever
 * component triggered it.
 *
 *   mark → (undo → gone from here, card restored)
 *        → (claim → sending → finish)
 */
import type { Task } from './types';

type Entry = { task: Task; state: 'waiting' | 'sending' };

const pending = new Map<string, Entry>();

/** Starts the Undo window for a task. */
export function markPendingDelete(task: Task): void {
  pending.set(task.id, { task, state: 'waiting' });
}

export function isPendingDelete(id: string): boolean {
  return pending.has(id);
}

/** Cancels a delete that hasn't been sent yet. Returns the task to restore, or null if too late. */
export function undoPendingDelete(id: string): Task | null {
  const entry = pending.get(id);
  if (!entry || entry.state !== 'waiting') return null;
  pending.delete(id);
  return entry.task;
}

/** Claims a waiting delete for sending. Returns null if it was undone or already claimed. */
export function claimPendingDelete(id: string): Task | null {
  const entry = pending.get(id);
  if (!entry || entry.state !== 'waiting') return null;
  entry.state = 'sending';
  return entry.task;
}

/** Claims every waiting delete (used on `pagehide`). */
export function claimAllPendingDeletes(): Task[] {
  const claimed: Task[] = [];
  for (const entry of pending.values()) {
    if (entry.state !== 'waiting') continue;
    entry.state = 'sending';
    claimed.push(entry.task);
  }
  return claimed;
}

/** The DELETE finished (or failed and the card was restored): stop filtering the id. */
export function finishPendingDelete(id: string): void {
  pending.delete(id);
}

/**
 * `select` for the tasks query. Returns the same array when nothing is pending, so the
 * query result keeps its identity and nothing re-renders needlessly.
 */
export function withoutPendingDeletes(tasks: Task[]): Task[] {
  if (pending.size === 0) return tasks;
  return tasks.filter((t) => !pending.has(t.id));
}

/** TEST-ONLY: forget every pending delete. */
export function resetPendingDeletesForTests(): void {
  pending.clear();
}
