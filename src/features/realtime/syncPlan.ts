import type { QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

/** Tables published to Supabase Realtime (migration 0006). */
export const SYNCED_TABLES = ['tasks', 'task_assignees', 'task_labels', 'comments'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

/**
 * Query-key prefixes to refetch when a table changes in another tab. Activity rows are written
 * by DB triggers on these same tables, so any change can add to a task's history.
 */
const PLAN: Record<SyncedTable, QueryKey[]> = {
  tasks: [queryKeys.tasks, ['activity']],
  task_assignees: [queryKeys.taskAssignees, ['activity']],
  task_labels: [queryKeys.taskLabels, ['activity']],
  comments: [['comments'], queryKeys.commentCounts],
};

/** Unique prefixes to invalidate for a batch of changed tables. */
export function keysToInvalidate(tables: Iterable<SyncedTable>): QueryKey[] {
  const seen = new Map<string, QueryKey>();
  for (const table of tables) {
    for (const key of PLAN[table]) seen.set(JSON.stringify(key), key);
  }
  return [...seen.values()];
}

export function isSyncedTable(value: unknown): value is SyncedTable {
  return typeof value === 'string' && (SYNCED_TABLES as readonly string[]).includes(value);
}
