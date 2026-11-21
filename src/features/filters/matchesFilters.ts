import type { Task } from '@/features/tasks/types';

/** One filter group's current selection plus its matcher (from `FilterGroup.useGroup()`). */
export type GroupMatcher = {
  selected: readonly string[];
  matches(task: Task, selected: readonly string[]): boolean;
};

/**
 * DESIGN §5.4: the title contains the trimmed `q` (case-insensitive, literal) AND every group
 * with a non-empty selection matches (each group ORs its own values). Empty selections are ignored.
 */
export function matchesFilters(task: Task, q: string, groups: readonly GroupMatcher[]): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !task.title.toLowerCase().includes(needle)) return false;
  return groups.every((g) => g.selected.length === 0 || g.matches(task, g.selected));
}
