import type { Task } from '@/features/tasks/types';
import { AvatarStack } from './Avatar';
import { useTaskMembers } from './useTaskMembers';

/** Card meta row: the task's assignees as a 20 px avatar stack (max 3, then "+N"). */
export function CardAssignees({ task }: { task: Task }) {
  const members = useTaskMembers(task.id);
  if (members.length === 0) return null;
  return <AvatarStack members={members} size={20} />;
}
