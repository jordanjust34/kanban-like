import { useCallback, useMemo } from 'react';
import type { FilterGroup, FilterOption } from '@/features/filters/types';
import { isTempId } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import { useMembers, useTaskAssignees } from './api';
import type { Member } from './model';

const NO_OPTIONS: FilterOption[] = [];

/** True when any of the task's assignees is selected (OR within the group). */
export function matchesAssignees(
  assignees: ReadonlyMap<string, readonly string[]> | undefined,
  task: Task,
  selected: readonly string[],
): boolean {
  const ids = assignees?.get(task.id);
  return ids !== undefined && ids.some((id) => selected.includes(id));
}

export function toOptions(members: readonly Member[]): FilterOption[] {
  return members
    .filter((m) => !isTempId(m.id))
    .map((m) => ({ id: m.id, label: m.name, color: m.color }));
}

/**
 * Calls the same hooks on every render. Options stay empty until both members and links have
 * loaded, so a `?assignee=` selection only applies once `matches` can see the links.
 */
function useAssigneeGroup() {
  const { data: members } = useMembers();
  const { data: assignees } = useTaskAssignees();
  const ready = assignees !== undefined;
  const options = useMemo(
    () => (ready && members ? toOptions(members) : NO_OPTIONS),
    [ready, members],
  );
  const matches = useCallback(
    (task: Task, selected: readonly string[]) => matchesAssignees(assignees, task, selected),
    [assignees],
  );
  return { options, matches };
}

export const assigneeFilterGroup: FilterGroup | null = {
  key: 'assignee',
  label: 'Assignee',
  useGroup: useAssigneeGroup,
};
