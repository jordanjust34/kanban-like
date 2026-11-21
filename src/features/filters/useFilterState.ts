import type { Task } from '@/features/tasks/types';
import { setSearchParams, useSearchString } from '@/lib/urlState';
import { FILTER_GROUPS } from './registry';
import type { FilterGroup, FilterOption } from './types';

export type FilterGroupState = {
  group: FilterGroup;
  options: FilterOption[];
  matches(task: Task, selected: readonly string[]): boolean;
  /**
   * Selected option ids from the URL, limited to ids that exist in `options` (in option order).
   * Unknown ids (a deleted label, a hand-edited URL) are dropped, so they never hide tasks.
   */
  selected: string[];
  /** Adds or removes one option (new history entry, so Back undoes it). */
  toggle(id: string): void;
  /** Removes every selection in this group. */
  clear(): void;
};

export type FilterState = {
  /** Raw search text from `?q=` (untrimmed, so the input keeps what the user typed). */
  q: string;
  /** Updates `?q=` without adding history entries (called on every keystroke). */
  setQ(value: string): void;
  groups: FilterGroupState[];
  /** Number of selected options across all groups. Search is not counted. */
  activeCount: number;
  /** True when the trimmed search or any group selection is set. */
  isFiltering: boolean;
  clearAll(): void;
};

/** Clears search and every filter group in one history entry. */
export function clearFilters() {
  setSearchParams({ q: null, priority: null, assignee: null, label: null }, 'push');
}

function setQ(value: string) {
  setSearchParams({ q: value }, 'replace');
}

/**
 * The board's filter state, read from the URL (DESIGN §5.4). Used by both the filter bar and
 * `useVisibleTasks`. Calls each group's `useGroup()` in the registry's fixed order.
 */
export function useFilterState(): FilterState {
  const search = useSearchString();
  const params = new URLSearchParams(search);
  const q = params.get('q') ?? '';

  // Hook-safe: FILTER_GROUPS is a module constant, so this always calls the same hooks in the
  // same order (see registry.ts). The linter can't see that, hence the disable.
  const groups = FILTER_GROUPS.map((group): FilterGroupState => {
    // oxlint-disable-next-line react/rules-of-hooks -- fixed-length module constant, see above.
    const { options, matches } = group.useGroup();
    const inUrl = new Set(params.getAll(group.key));
    const selected = options.filter((o) => inUrl.has(o.id)).map((o) => o.id);
    return {
      group,
      options,
      matches,
      selected,
      toggle: (id) =>
        setSearchParams(
          {
            [group.key]: selected.includes(id)
              ? selected.filter((s) => s !== id)
              : [...selected, id],
          },
          'push',
        ),
      clear: () => setSearchParams({ [group.key]: null }, 'push'),
    };
  });

  const activeCount = groups.reduce((n, g) => n + g.selected.length, 0);
  return {
    q,
    setQ,
    groups,
    activeCount,
    isFiltering: q.trim() !== '' || activeCount > 0,
    clearAll: clearFilters,
  };
}
