import type { Status } from '@/lib/domain';
import type { Task } from './types';

/** Builds a task row for tests. */
export function makeTask(
  id: string,
  status: Status,
  position: number,
  patch: Partial<Task> = {},
): Task {
  return {
    id,
    user_id: 'user-1',
    title: `Task ${id}`,
    description: null,
    status,
    priority: 'normal',
    due_date: null,
    position,
    created_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
    ...patch,
  };
}
