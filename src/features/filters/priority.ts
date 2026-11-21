import type { Task } from '@/features/tasks/types';
import { PRIORITIES } from '@/lib/domain';
import type { FilterGroup, FilterOption } from './types';

const OPTIONS: FilterOption[] = PRIORITIES.map((p) => ({ id: p.value, label: p.label }));

const matches = (task: Task, selected: readonly string[]) => selected.includes(task.priority);

/** Static group: no data to load, so `useGroup` calls no hooks and returns stable values. */
export const priorityFilterGroup: FilterGroup = {
  key: 'priority',
  label: 'Priority',
  useGroup: () => ({ options: OPTIONS, matches }),
};
