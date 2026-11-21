/**
 * Domain constants shared by every feature. FROZEN: only the main session edits this file.
 * DB values must match the CHECK constraints in supabase/migrations/0001_init.sql.
 */

export const STATUSES = [
  { value: 'todo', label: 'To Do', accent: '#8B8D98' },
  { value: 'in_progress', label: 'In Progress', accent: '#3E63DD' },
  { value: 'in_review', label: 'In Review', accent: '#8E4EC6' },
  { value: 'done', label: 'Done', accent: '#30A46C' },
] as const;

export type Status = (typeof STATUSES)[number]['value'];

export const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s])) as {
  [K in Status]: Extract<(typeof STATUSES)[number], { value: K }>;
};

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && value in STATUS_BY_VALUE;
}

/** Ordered high → low (the order used in pickers and filters). */
export const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
] as const;

export type Priority = (typeof PRIORITIES)[number]['value'];

export const DEFAULT_PRIORITY: Priority = 'normal';

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && PRIORITIES.some((p) => p.value === value);
}

/** 8-swatch palette for labels and team members (DESIGN §6.2). */
export const SWATCHES = [
  '#E5484D',
  '#F76B15',
  '#F5A524',
  '#30A46C',
  '#12A594',
  '#3E63DD',
  '#8E4EC6',
  '#D6409F',
] as const;

export const BOARD_NAME = 'Next Play · Sprint Board';

/** Field limits — mirror the DB CHECK constraints so the UI can validate before sending. */
export const LIMITS = {
  taskTitle: 200,
  taskDescription: 5000,
  memberName: 60,
  labelName: 30,
  commentBody: 2000,
} as const;
