import { createContext, useContext } from 'react';
import type { Status } from '@/lib/domain';
import type { Task } from '@/features/tasks/types';

/**
 * Card-level actions provided once by the Board, so memoised cards don't each subscribe to
 * mutation hooks. The value is stable for the life of the board.
 */
export type BoardActions = {
  /** Moves a card to the top of another column (the card menu's "Move to"). */
  moveToColumn(task: Task, status: Status): void;
  /** Deletes with a 5 s Undo toast. */
  deleteTask(task: Task): void;
};

export const BoardActionsContext = createContext<BoardActions | null>(null);

export function useBoardActions(): BoardActions {
  const actions = useContext(BoardActionsContext);
  if (!actions) throw new Error('useBoardActions must be used inside <Board>');
  return actions;
}
