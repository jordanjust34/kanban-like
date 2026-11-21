import type { Label } from './labelList';

/** Builds a label row for tests. */
export function makeLabel(id: string, name: string, color = '#3E63DD'): Label {
  return { id, name, color, user_id: 'user-1', created_at: '2026-11-20T10:00:00.000Z' };
}
