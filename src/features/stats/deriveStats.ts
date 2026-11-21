import { getDueUrgency } from '@/features/due/dueUrgency';
import type { Task } from '@/features/tasks/types';

export type BoardStatsData = {
  total: number;
  done: number;
  /** Not done, with a due date before `today` (same rule as the red card badge). */
  overdue: number;
  /** Rounded 0–100; 0 for an empty board. */
  percentDone: number;
};

/** Whole-board summary (DESIGN §7.5). Pure, so it can be derived from the cached list on render. */
export function deriveStats(tasks: readonly Task[], today: Date): BoardStatsData {
  let done = 0;
  let overdue = 0;
  for (const task of tasks) {
    if (task.status === 'done') done += 1;
    else if (getDueUrgency(task.due_date, task.status, today)?.tone === 'danger') overdue += 1;
  }
  const total = tasks.length;
  return { total, done, overdue, percentDone: total === 0 ? 0 : Math.round((done / total) * 100) };
}
