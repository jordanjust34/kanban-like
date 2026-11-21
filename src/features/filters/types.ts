/**
 * Filter-group contract (IMPLEMENTATION_PLAN §3). FROZEN: only the main session edits this file.
 *
 * Each feature that adds a filter exports one `FilterGroup` from its own `filter.ts`;
 * `features/filters/registry.ts` lists them in a fixed order.
 */
import type { Task } from '@/features/tasks/types';

export type FilterOption = {
  id: string;
  label: string;
  /** Swatch shown next to the option (labels, members). */
  color?: string;
};

export type FilterGroup = {
  /** Also the URL search-param name. */
  key: 'priority' | 'assignee' | 'label';
  /** Button text in the toolbar, e.g. "Priority". */
  label: string;
  /**
   * React hook. Called on every render of the filter bar and the board, in the registry's
   * fixed order, so the Rules of Hooks hold. Load whatever data `matches` needs here.
   * `matches` is only called when `selected` is non-empty; OR within the group.
   */
  useGroup(): {
    options: FilterOption[];
    matches(task: Task, selected: readonly string[]): boolean;
  };
};
