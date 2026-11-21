import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import * as api from './api';
import { labelFilterGroup, matchesLabels } from './filter';
import { toTaskLabelMap } from './labelList';
import { mockLabelData } from './testApi';
import { makeLabel } from './testUtils';

vi.mock('./api', async () => (await import('./testApi')).apiMockFactory());

const LABELS = [makeLabel('l-bug', 'Bug', '#E5484D'), makeLabel('l-feat', 'Feature', '#3E63DD')];
const LINKS = [
  { task_id: 'a', label_id: 'l-bug' },
  { task_id: 'b', label_id: 'l-feat' },
  { task_id: 'c', label_id: 'l-bug' },
  { task_id: 'c', label_id: 'l-feat' },
];
const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => makeTask(id, 'todo', 1000));

describe('matchesLabels', () => {
  const map = toTaskLabelMap(LINKS);

  it('matches when any of the task labels is selected', () => {
    expect(matchesLabels(map, a!, ['l-bug'])).toBe(true);
    expect(matchesLabels(map, b!, ['l-bug'])).toBe(false);
    expect(matchesLabels(map, c!, ['l-feat'])).toBe(true);
    expect(matchesLabels(map, b!, ['l-bug', 'l-feat'])).toBe(true);
  });

  it('never matches an unlabeled task, or before links load', () => {
    expect(matchesLabels(map, d!, ['l-bug'])).toBe(false);
    expect(matchesLabels(undefined, a!, ['l-bug'])).toBe(false);
  });
});

describe('labelFilterGroup', () => {
  it('is the "label" group', () => {
    expect(labelFilterGroup).toMatchObject({ key: 'label', label: 'Label' });
  });

  it('offers the labels with their colors, referentially stable across renders', () => {
    mockLabelData(api, LABELS, LINKS);
    const { result, rerender } = renderHook(() => labelFilterGroup!.useGroup());
    expect(result.current.options).toEqual([
      { id: 'l-bug', label: 'Bug', color: '#E5484D' },
      { id: 'l-feat', label: 'Feature', color: '#3E63DD' },
    ]);
    expect(result.current.matches(c!, ['l-bug'])).toBe(true);

    const first = result.current;
    rerender();
    expect(result.current.options).toBe(first.options);
    expect(result.current.matches).toBe(first.matches);
  });

  it('has no options while loading', () => {
    mockLabelData(api, undefined, undefined);
    const { result } = renderHook(() => labelFilterGroup!.useGroup());
    expect(result.current.options).toEqual([]);
  });
});
