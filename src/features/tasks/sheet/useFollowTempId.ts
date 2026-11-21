import { useEffect, useState } from 'react';
import { isTempId } from '../taskList';
import type { Task } from '../types';

/**
 * While the sheet shows an optimistic task (`temp-…` id), remember it; when the insert returns
 * and the cache swaps it for the real row, report the real id so the URL can follow. The swap
 * keeps title, status and position, which is how the real row is recognised.
 */
export function useFollowTempId(
  taskId: string,
  tasks: readonly Task[] | undefined,
  onResolve: (realId: string) => void,
) {
  const [tempTask, setTempTask] = useState<Task | null>(null);
  const current = isTempId(taskId) ? tasks?.find((t) => t.id === taskId) : undefined;
  if (current && current !== tempTask) setTempTask(current);

  useEffect(() => {
    if (!tempTask || tempTask.id !== taskId || !tasks) return;
    if (tasks.some((t) => t.id === taskId)) return;
    const real = tasks.find(
      (t) =>
        !isTempId(t.id) &&
        t.title === tempTask.title &&
        t.status === tempTask.status &&
        t.position === tempTask.position,
    );
    if (real) onResolve(real.id);
  }, [onResolve, taskId, tasks, tempTask]);
}
