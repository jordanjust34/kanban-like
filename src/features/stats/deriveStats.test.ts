import { describe, expect, it } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import { deriveStats } from './deriveStats';

const TODAY = new Date(2026, 10, 20, 9, 0);

describe('deriveStats', () => {
  it('is all zeros for an empty board', () => {
    expect(deriveStats([], TODAY)).toEqual({ total: 0, done: 0, overdue: 0, percentDone: 0 });
  });

  it('counts total, done and rounds the percentage', () => {
    const tasks = [
      makeTask('a', 'todo', 1),
      makeTask('b', 'done', 1),
      makeTask('c', 'in_progress', 1),
    ];
    expect(deriveStats(tasks, TODAY)).toMatchObject({ total: 3, done: 1, percentDone: 33 });
    expect(deriveStats([...tasks, makeTask('d', 'done', 2)], TODAY).percentDone).toBe(50);
    expect(
      deriveStats([makeTask('e', 'done', 1), makeTask('f', 'done', 2), tasks[0]!], TODAY)
        .percentDone,
    ).toBe(67);
  });

  it('counts overdue tasks, excluding done ones and ones without a date', () => {
    const tasks = [
      makeTask('late', 'todo', 1, { due_date: '2026-11-17' }),
      makeTask('late2', 'in_review', 1, { due_date: '2026-11-19' }),
      makeTask('today', 'todo', 2, { due_date: '2026-11-20' }),
      makeTask('later', 'todo', 3, { due_date: '2026-12-01' }),
      makeTask('done-late', 'done', 1, { due_date: '2026-11-01' }),
      makeTask('no-date', 'todo', 4),
    ];
    expect(deriveStats(tasks, TODAY)).toEqual({ total: 6, done: 1, overdue: 2, percentDone: 17 });
  });

  it('is 100% when everything is done', () => {
    expect(deriveStats([makeTask('a', 'done', 1)], TODAY).percentDone).toBe(100);
  });
});
