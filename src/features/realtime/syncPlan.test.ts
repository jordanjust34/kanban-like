import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { isSyncedTable, keysToInvalidate } from './syncPlan';

describe('keysToInvalidate', () => {
  it('refetches tasks and task activity when tasks change', () => {
    expect(keysToInvalidate(['tasks'])).toEqual([queryKeys.tasks, ['activity']]);
  });

  it('deduplicates shared prefixes across tables', () => {
    const keys = keysToInvalidate(['tasks', 'task_labels', 'task_assignees']);
    expect(keys).toEqual([
      queryKeys.tasks,
      ['activity'],
      queryKeys.taskLabels,
      queryKeys.taskAssignees,
    ]);
  });

  it('refetches comments and counts when comments change', () => {
    expect(keysToInvalidate(['comments'])).toEqual([['comments'], queryKeys.commentCounts]);
  });

  it('returns nothing for an empty batch', () => {
    expect(keysToInvalidate([])).toEqual([]);
  });
});

describe('isSyncedTable', () => {
  it('accepts only published tables', () => {
    expect(isSyncedTable('comments')).toBe(true);
    expect(isSyncedTable('labels')).toBe(false);
    expect(isSyncedTable(undefined)).toBe(false);
  });
});
