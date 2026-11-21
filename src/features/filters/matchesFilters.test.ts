import { describe, expect, it } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import type { Task } from '@/features/tasks/types';
import { matchesFilters, type GroupMatcher } from './matchesFilters';

const byPriority = (selected: string[]): GroupMatcher => ({
  selected,
  matches: (task, sel) => sel.includes(task.priority),
});

const byTag = (tags: Record<string, string[]>, selected: string[]): GroupMatcher => ({
  selected,
  matches: (task, sel) => (tags[task.id] ?? []).some((t) => sel.includes(t)),
});

const task = (patch: Partial<Task> = {}) => makeTask('t1', 'todo', 1000, patch);

describe('matchesFilters', () => {
  it('matches everything with no query and no groups', () => {
    expect(matchesFilters(task(), '', [])).toBe(true);
  });

  describe('search query', () => {
    it('matches a title substring case-insensitively', () => {
      const t = task({ title: 'Fix Login bug' });
      expect(matchesFilters(t, 'login', [])).toBe(true);
      expect(matchesFilters(t, 'LOGIN', [])).toBe(true);
      expect(matchesFilters(t, 'in bu', [])).toBe(true);
    });

    it('rejects titles that do not contain the query', () => {
      expect(matchesFilters(task({ title: 'Fix login bug' }), 'signup', [])).toBe(false);
    });

    it('trims the query and ignores a whitespace-only query', () => {
      const t = task({ title: 'Fix login bug' });
      expect(matchesFilters(t, '  login  ', [])).toBe(true);
      expect(matchesFilters(t, '   ', [])).toBe(true);
    });

    it('does not search the description', () => {
      const t = task({ title: 'Ship it', description: 'login flow' });
      expect(matchesFilters(t, 'login', [])).toBe(false);
    });

    it('treats regex characters literally', () => {
      expect(matchesFilters(task({ title: 'a.b (c)' }), '.b (', [])).toBe(true);
      expect(matchesFilters(task({ title: 'axb' }), 'a.b', [])).toBe(false);
    });
  });

  describe('groups', () => {
    it('ignores a group with an empty selection without calling it', () => {
      const group: GroupMatcher = {
        selected: [],
        matches: () => {
          throw new Error('should not be called');
        },
      };
      expect(matchesFilters(task(), '', [group])).toBe(true);
    });

    it('ORs the values within a group', () => {
      const group = byPriority(['high', 'low']);
      expect(matchesFilters(task({ priority: 'high' }), '', [group])).toBe(true);
      expect(matchesFilters(task({ priority: 'low' }), '', [group])).toBe(true);
      expect(matchesFilters(task({ priority: 'normal' }), '', [group])).toBe(false);
    });

    it('ANDs across groups', () => {
      const tags = { t1: ['bug'] };
      const t = task({ priority: 'high' });
      expect(matchesFilters(t, '', [byPriority(['high']), byTag(tags, ['bug'])])).toBe(true);
      expect(matchesFilters(t, '', [byPriority(['high']), byTag(tags, ['feature'])])).toBe(false);
      expect(matchesFilters(t, '', [byPriority(['low']), byTag(tags, ['bug'])])).toBe(false);
    });

    it('ANDs the query with the groups', () => {
      const t = task({ title: 'Fix login bug', priority: 'high' });
      expect(matchesFilters(t, 'login', [byPriority(['high'])])).toBe(true);
      expect(matchesFilters(t, 'signup', [byPriority(['high'])])).toBe(false);
      expect(matchesFilters(t, 'login', [byPriority(['low'])])).toBe(false);
    });

    it('mixes empty and active groups', () => {
      const t = task({ priority: 'normal' });
      expect(matchesFilters(t, '', [byTag({}, []), byPriority(['normal'])])).toBe(true);
    });
  });
});
