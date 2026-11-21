import type { Task } from '@/features/tasks/types';

// Slot stub (pass-through): filled in by P3a (filters).
export function useVisibleTasks(tasks: Task[]): { visible: Task[]; isFiltering: boolean } {
  return { visible: tasks, isFiltering: false };
}
