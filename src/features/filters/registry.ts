import { labelFilterGroup } from '@/features/labels/filter';
import { assigneeFilterGroup } from '@/features/members/filter';
import { priorityFilterGroup } from './priority';
import type { FilterGroup } from './types';

/**
 * Every filter group, in toolbar order.
 *
 * Hook safety: this is a module-level constant, fixed when the module loads (a group is either
 * present or `null` at build time, never toggled at runtime). Calling each group's `useGroup()`
 * in array order on every render therefore always calls the same hooks in the same order,
 * which is what the Rules of Hooks require.
 */
export const FILTER_GROUPS: readonly FilterGroup[] = [
  priorityFilterGroup,
  assigneeFilterGroup,
  labelFilterGroup,
].filter((g): g is FilterGroup => g !== null);
