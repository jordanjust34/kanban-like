import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import type * as Api from './api';
import { mockApi } from './apiMock';
import { assigneeFilterGroup, matchesAssignees } from './filter';
import { groupAssignees } from './model';
import { makeMember } from './testUtils';

vi.mock('./api', () => ({
  useMembers: vi.fn<typeof Api.useMembers>(),
  useTaskAssignees: vi.fn<typeof Api.useTaskAssignees>(),
  useAssignedTaskCounts: vi.fn<typeof Api.useAssignedTaskCounts>(),
  useCreateMember: vi.fn<typeof Api.useCreateMember>(),
  useUpdateMember: vi.fn<typeof Api.useUpdateMember>(),
  useDeleteMember: vi.fn<typeof Api.useDeleteMember>(),
  useToggleAssignee: vi.fn<typeof Api.useToggleAssignee>(),
}));

const members = [
  makeMember('m1', 'Maya Chen'),
  makeMember('m2', 'Leo Martins', { color: '#12A594' }),
];
const links = [
  { task_id: 't1', member_id: 'm1' },
  { task_id: 't2', member_id: 'm1' },
  { task_id: 't2', member_id: 'm2' },
];

const group = assigneeFilterGroup!;

beforeEach(() => {
  mockApi({ members, links });
});

describe('matchesAssignees', () => {
  const map = groupAssignees(links);
  it('matches when any assignee is selected', () => {
    expect(matchesAssignees(map, makeTask('t1', 'todo', 1), ['m1'])).toBe(true);
    expect(matchesAssignees(map, makeTask('t2', 'todo', 1), ['m2', 'mX'])).toBe(true);
    expect(matchesAssignees(map, makeTask('t1', 'todo', 1), ['m2'])).toBe(false);
  });

  it('never matches unassigned tasks or before links load', () => {
    expect(matchesAssignees(map, makeTask('t3', 'todo', 1), ['m1'])).toBe(false);
    expect(matchesAssignees(undefined, makeTask('t1', 'todo', 1), ['m1'])).toBe(false);
  });
});

describe('assigneeFilterGroup', () => {
  it('is keyed "assignee" and lists members with their color', () => {
    expect(group.key).toBe('assignee');
    expect(group.label).toBe('Assignee');
    const { result } = renderHook(() => group.useGroup());
    expect(result.current.options).toEqual([
      { id: 'm1', label: 'Maya Chen', color: '#8E4EC6' },
      { id: 'm2', label: 'Leo Martins', color: '#12A594' },
    ]);
    expect(result.current.matches(makeTask('t2', 'todo', 1), ['m2'])).toBe(true);
  });

  it('keeps options and matches referentially stable across renders', () => {
    const { result, rerender } = renderHook(() => group.useGroup());
    const first = result.current;
    rerender();
    expect(result.current.options).toBe(first.options);
    expect(result.current.matches).toBe(first.matches);
  });

  it('has no options until the links have loaded', () => {
    mockApi({ members, linksLoaded: false });
    const { result } = renderHook(() => group.useGroup());
    expect(result.current.options).toEqual([]);
  });

  it('leaves out members that are still being created', () => {
    mockApi({ members: [...members, makeMember('temp-x', 'New')], links });
    const { result } = renderHook(() => group.useGroup());
    expect(result.current.options.map((o) => o.id)).toEqual(['m1', 'm2']);
  });
});
