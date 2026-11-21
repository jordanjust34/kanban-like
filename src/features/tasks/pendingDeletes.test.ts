import { describe, it, expect, beforeEach } from 'vitest';
import {
  claimAllPendingDeletes,
  claimPendingDelete,
  finishPendingDelete,
  isPendingDelete,
  markPendingDelete,
  resetPendingDeletesForTests,
  undoPendingDelete,
  withoutPendingDeletes,
} from './pendingDeletes';
import { removeTask, upsertTask } from './taskList';
import { makeTask } from './testUtils';

const board = [
  makeTask('a', 'todo', 1000),
  makeTask('b', 'todo', 2000),
  makeTask('c', 'todo', 3000),
];
const b = board[1] ?? makeTask('b', 'todo', 2000);

beforeEach(resetPendingDeletesForTests);

describe('pendingDeletes', () => {
  it('returns the same array when nothing is pending', () => {
    expect(withoutPendingDeletes(board)).toBe(board);
  });

  it('filters a pending delete out of refetched data', () => {
    markPendingDelete(b);
    // A refetch during the Undo window still contains the row…
    expect(withoutPendingDeletes(board).map((t) => t.id)).toEqual(['a', 'c']);
    // …and so does a refetch while the DELETE is in flight.
    expect(claimPendingDelete('b')).toEqual(b);
    expect(withoutPendingDeletes(board).map((t) => t.id)).toEqual(['a', 'c']);
    finishPendingDelete('b');
    expect(withoutPendingDeletes(board)).toBe(board);
  });

  it('undo returns the task so it is restored in its original position', () => {
    markPendingDelete(b);
    const cache = removeTask(board, 'b');
    const restored = undoPendingDelete('b');
    expect(restored).toEqual(b);
    expect(isPendingDelete('b')).toBe(false);
    expect(upsertTask(cache, b)).toEqual(board);
  });

  it('a delete can only be undone or sent once', () => {
    markPendingDelete(b);
    expect(undoPendingDelete('b')).toEqual(b);
    expect(claimPendingDelete('b')).toBeNull(); // toast closing after Undo sends nothing
    expect(undoPendingDelete('b')).toBeNull();

    markPendingDelete(b);
    expect(claimPendingDelete('b')).toEqual(b);
    expect(claimPendingDelete('b')).toBeNull();
    expect(undoPendingDelete('b')).toBeNull(); // too late once sending
  });

  it('pagehide claims every waiting delete exactly once', () => {
    const a = board[0] ?? b;
    markPendingDelete(a);
    markPendingDelete(b);
    claimPendingDelete('b');
    expect(claimAllPendingDeletes().map((t) => t.id)).toEqual(['a']);
    expect(claimAllPendingDeletes()).toEqual([]);
  });
});
