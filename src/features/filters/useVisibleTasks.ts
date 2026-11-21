import { useMemo } from 'react';
import type { Task } from '@/features/tasks/types';
import { matchesFilters } from './matchesFilters';
import { useFilterState } from './useFilterState';

/**
 * The tasks the board should show under the current search and filters (URL state).
 * Returns the input array itself when nothing is active, so downstream memos stay stable.
 */
export function useVisibleTasks(tasks: Task[]): { visible: Task[]; isFiltering: boolean } {
  const { q, groups, isFiltering } = useFilterState();

  // `groups` is rebuilt every render; key the memo on what it contains instead. The list has a
  // fixed length because the registry is a module constant.
  const groupDeps = groups.flatMap((g) => [g.matches, g.selected.join('\u0000')]);
  const visible = useMemo(
    () => (isFiltering ? tasks.filter((task) => matchesFilters(task, q, groups)) : tasks),
    // oxlint-disable-next-line react/exhaustive-deps -- `groupDeps` stands in for `groups`.
    [tasks, isFiltering, q, ...groupDeps],
  );

  return { visible, isFiltering };
}
