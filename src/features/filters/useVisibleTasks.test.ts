import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import { setSearchParams } from '@/lib/urlState';
import { useVisibleTasks } from './useVisibleTasks';

const TASKS = [
  makeTask('a', 'todo', 1000, { title: 'Fix login bug', priority: 'high' }),
  makeTask('b', 'todo', 2000, { title: 'Write docs', priority: 'low' }),
  makeTask('c', 'in_progress', 1000, { title: 'Login page polish', priority: 'normal' }),
  makeTask('d', 'done', 1000, { title: 'Ship v1', priority: 'high' }),
];

const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

function setUrl(search: string) {
  window.history.replaceState(null, '', `/${search}`);
}

function render() {
  return renderHook(() => useVisibleTasks(TASKS));
}

beforeEach(() => setUrl(''));

describe('useVisibleTasks', () => {
  it('passes the same array through when nothing is active', () => {
    const { result } = render();
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.visible).toBe(TASKS);
  });

  it('filters by the search query from ?q=', () => {
    setUrl('?q=login');
    const { result } = render();
    expect(result.current.isFiltering).toBe(true);
    expect(ids(result.current.visible)).toEqual(['a', 'c']);
  });

  it('ignores a whitespace-only query', () => {
    setUrl('?q=%20%20');
    const { result } = render();
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.visible).toBe(TASKS);
  });

  it('ORs repeated priority values and ANDs them with the query', () => {
    setUrl('?priority=high&priority=low');
    const { result, unmount } = render();
    expect(ids(result.current.visible)).toEqual(['a', 'b', 'd']);
    unmount();

    setUrl('?priority=high&q=ship');
    expect(ids(render().result.current.visible)).toEqual(['d']);
  });

  it('ignores unknown ids in the URL', () => {
    setUrl('?priority=urgent&label=deleted-label&assignee=gone');
    const { result } = render();
    expect(result.current.isFiltering).toBe(false);
    expect(result.current.visible).toBe(TASKS);

    setUrl('?priority=urgent&priority=low');
    expect(ids(render().result.current.visible)).toEqual(['b']);
  });

  it('re-filters when the URL changes', () => {
    const { result } = render();
    act(() => setSearchParams({ priority: ['normal'] }));
    expect(ids(result.current.visible)).toEqual(['c']);
    act(() => setSearchParams({ priority: null }));
    expect(result.current.visible).toBe(TASKS);
  });

  it('returns an empty list (still filtering) when nothing matches', () => {
    setUrl('?q=nothing-matches-this');
    const { result } = render();
    expect(result.current).toEqual({ visible: [], isFiltering: true });
  });
});
