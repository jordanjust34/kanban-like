import { describe, it, expect } from 'vitest';
import {
  applyPatches,
  groupByStatus,
  isTempId,
  makeTempId,
  planMove,
  removeTask,
  replaceTask,
  restoreTasks,
  sortTasks,
  topPosition,
  upsertTask,
} from './taskList';
import { makeTask } from './testUtils';

const board = [
  makeTask('a', 'todo', 1000),
  makeTask('b', 'todo', 2000),
  makeTask('c', 'todo', 3000),
  makeTask('x', 'in_progress', 1000),
  makeTask('y', 'in_progress', 2000),
];

const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

describe('groupByStatus', () => {
  it('groups into all four columns, ordered by position', () => {
    const groups = groupByStatus([...board].reverse());
    expect(ids(groups.todo)).toEqual(['a', 'b', 'c']);
    expect(ids(groups.in_progress)).toEqual(['x', 'y']);
    expect(groups.in_review).toEqual([]);
    expect(groups.done).toEqual([]);
  });
});

describe('planMove', () => {
  it('moves across columns between two neighbours with only one write', () => {
    expect(
      planMove(board, { id: 'a', status: 'in_progress', afterId: 'x', beforeId: 'y' }),
    ).toEqual([{ id: 'a', status: 'in_progress', position: 1500 }]);
  });

  it('moves to the top and bottom of a column', () => {
    expect(planMove(board, { id: 'a', status: 'in_progress', beforeId: 'x' })?.[0]?.position).toBe(
      0,
    );
    expect(planMove(board, { id: 'a', status: 'in_progress', afterId: 'y' })?.[0]?.position).toBe(
      3000,
    );
  });

  it('drops into an empty column at 1000', () => {
    expect(planMove(board, { id: 'a', status: 'done' })).toEqual([
      { id: 'a', status: 'done', position: 1000 },
    ]);
  });

  it('reorders within a column', () => {
    expect(planMove(board, { id: 'c', status: 'todo', beforeId: 'a' })).toEqual([
      { id: 'c', status: 'todo', position: 0 },
    ]);
  });

  it('returns null when the card would land where it already is', () => {
    expect(planMove(board, { id: 'b', status: 'todo', afterId: 'a', beforeId: 'c' })).toBeNull();
    expect(planMove(board, { id: 'b', status: 'todo', afterId: 'a' })).toBeNull();
    expect(planMove(board, { id: 'missing', status: 'todo' })).toBeNull();
  });

  it('renumbers the target column when the gap is exhausted', () => {
    const tight = [
      makeTask('p', 'todo', 1),
      makeTask('q', 'todo', 1 + 1e-10),
      makeTask('r', 'todo', 5),
      makeTask('m', 'done', 1000),
    ];
    const patches = planMove(tight, { id: 'm', status: 'todo', afterId: 'p', beforeId: 'q' });
    expect(patches?.[0]).toEqual({ id: 'm', status: 'todo', position: 2000 });
    expect(patches?.slice(1)).toEqual([
      { id: 'p', position: 1000 },
      { id: 'q', position: 3000 },
      { id: 'r', position: 4000 },
    ]);
    const after = groupByStatus(applyPatches(tight, patches ?? []));
    expect(ids(after.todo)).toEqual(['p', 'm', 'q', 'r']);
  });
});

describe('optimistic list helpers', () => {
  it('applyPatches moves the card and keeps the list sorted', () => {
    const next = applyPatches(board, [{ id: 'c', status: 'in_progress', position: 1500 }]);
    expect(ids(groupByStatus(next).in_progress)).toEqual(['x', 'c', 'y']);
    expect(board.find((t) => t.id === 'c')?.status).toBe('todo'); // input untouched
  });

  it('restoreTasks rolls the touched rows back to their snapshot', () => {
    const snapshot = board.filter((t) => t.id === 'c');
    const moved = applyPatches(board, [{ id: 'c', status: 'done', position: 1000 }]);
    expect(restoreTasks(moved, snapshot)).toEqual(sortTasks(board));
  });

  it('creates at the top of a column with a temp id, then swaps in the real row', () => {
    const tempId = makeTempId();
    expect(isTempId(tempId)).toBe(true);
    expect(isTempId('a')).toBe(false);

    const position = topPosition(board, 'todo');
    expect(position).toBe(0);
    const withTemp = upsertTask(board, makeTask(tempId, 'todo', position));
    expect(ids(groupByStatus(withTemp).todo)).toEqual([tempId, 'a', 'b', 'c']);

    const real = makeTask('real', 'todo', position);
    const swapped = replaceTask(withTemp, tempId, real);
    expect(ids(groupByStatus(swapped).todo)).toEqual(['real', 'a', 'b', 'c']);
    expect(swapped.some((t) => t.id === tempId)).toBe(false);
  });

  it('removeTask and upsertTask round-trip a delete + undo to the same place', () => {
    const victim = board[1];
    if (!victim) throw new Error('fixture');
    const removed = removeTask(board, victim.id);
    expect(ids(removed)).not.toContain('b');
    expect(upsertTask(removed, victim)).toEqual(sortTasks(board));
  });
});
