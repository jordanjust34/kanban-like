/**
 * TanStack Query keys. FROZEN: only the main session edits this file.
 * Every cached query in the app uses one of these keys, so invalidation stays predictable.
 */
export const queryKeys = {
  session: ['session'] as const,
  tasks: ['tasks'] as const,
  members: ['members'] as const,
  labels: ['labels'] as const,
  /** All task↔member links for the current user (one query, mapped client-side). */
  taskAssignees: ['task_assignees'] as const,
  /** All task↔label links for the current user (one query, mapped client-side). */
  taskLabels: ['task_labels'] as const,
  activity: (taskId: string) => ['activity', taskId] as const,
  comments: (taskId: string) => ['comments', taskId] as const,
  commentCounts: ['comment_counts'] as const,
};
