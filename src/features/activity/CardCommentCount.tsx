import { MessageSquare } from 'lucide-react';
import type { Task } from '@/features/tasks/types';
import { useCommentCounts } from './api';

/**
 * Comment count on the card meta row. Non-interactive (the card itself is the button) and short:
 * icon + number, announced as "3 comments" inside the card's accessible name. Nothing at zero.
 */
export function CardCommentCount({ task }: { task: Task }) {
  const count = useCommentCounts()?.get(task.id) ?? 0;
  if (count === 0) return null;
  const noun = count === 1 ? 'comment' : 'comments';

  return (
    <span
      title={`${count} ${noun}`}
      className="inline-flex h-5 shrink-0 items-center gap-1 text-meta text-subtle tabular-nums"
    >
      <MessageSquare aria-hidden className="size-3.5" strokeWidth={2} />
      {count}
      <span className="sr-only"> {noun}</span>
    </span>
  );
}
