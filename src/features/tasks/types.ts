/**
 * Task types. Created in Phase 0; owned by the Phase 2 (board) agent afterwards.
 * Other features import `Task` from here, never from database.types.ts directly.
 */
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import type { Priority, Status } from '@/lib/domain';

/** DB row with `status` / `priority` narrowed from `string` to their unions. */
export type Task = Omit<Tables<'tasks'>, 'status' | 'priority'> & {
  status: Status;
  priority: Priority;
};

export type TaskInsert = Omit<TablesInsert<'tasks'>, 'user_id' | 'status' | 'priority'> & {
  status?: Status;
  priority?: Priority;
};

export type TaskUpdate = Omit<TablesUpdate<'tasks'>, 'user_id' | 'id' | 'status' | 'priority'> & {
  status?: Status;
  priority?: Priority;
};
