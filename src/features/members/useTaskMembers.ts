import { useMemo } from 'react';
import { useMembers, useTaskAssignees } from './api';
import type { Member } from './model';

const NONE: Member[] = [];

/** The task's assigned members, in team order (stable reference while nothing changes). */
export function useTaskMembers(taskId: string): Member[] {
  const { data: members } = useMembers();
  const { data: assignees } = useTaskAssignees();
  const ids = assignees?.get(taskId);
  return useMemo(() => {
    if (!members || !ids || ids.length === 0) return NONE;
    const assigned = new Set(ids);
    return members.filter((m) => assigned.has(m.id));
  }, [members, ids]);
}
