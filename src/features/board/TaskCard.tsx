import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { memo, type KeyboardEvent } from 'react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { openTask } from '@/lib/urlState';
import { CardCommentCount } from '@/features/activity/CardCommentCount';
import { DueBadge } from '@/features/due/DueBadge';
import { CardLabels } from '@/features/labels/CardLabels';
import { CardAssignees } from '@/features/members/CardAssignees';
import { isTempId } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import { CardMenu } from './CardMenu';
import { PriorityIndicator } from './PriorityIndicator';

type CardVariant = 'default' | 'overlay';

/**
 * Card body (DESIGN §7.2): labels · title (2-line clamp) · meta row. Slot wrappers use
 * `empty:hidden`, so a slot that renders nothing leaves no gap. Memoised: during a drag only the
 * sortable wrapper re-renders on every pointer move, never this.
 */
export const TaskCardBody = memo(function TaskCardBody({
  task,
  variant = 'default',
}: {
  task: Task;
  variant?: CardVariant;
}) {
  const saving = isTempId(task.id);
  const overlay = variant === 'overlay';

  return (
    <div
      data-overlay-card={overlay || undefined}
      className={cn(
        'group/card relative rounded-md bg-card p-3 shadow-card ring-1 ring-black/[0.04]',
        'transition-[box-shadow,transform] duration-150 ease-out',
        overlay
          ? 'scale-[1.02] rotate-2 shadow-dragging starting:scale-100 starting:rotate-0 starting:shadow-card'
          : 'group-hover/sortable:shadow-card-hover',
      )}
    >
      <div className="mb-2 flex flex-wrap gap-1 pr-6 empty:hidden">
        <CardLabels task={task} />
      </div>

      <h3 className="line-clamp-2 pr-6 text-card-title break-words text-primary">{task.title}</h3>

      <div className="mt-2.5 flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <PriorityIndicator priority={task.priority} />
        <DueBadge task={task} />
        <CardCommentCount task={task} />
        <div className="ml-auto flex items-center empty:hidden">
          <CardAssignees task={task} />
        </div>
      </div>

      {saving && (
        <span className="absolute top-3 right-3 text-subtle" title="Saving…">
          <Spinner size={12} label="Saving" />
        </span>
      )}
    </div>
  );
});

/** Sortable wrapper: owns the drag handle, focus, click / Enter to open, and the placeholder. */
export const SortableTaskCard = memo(function SortableTaskCard({ task }: { task: Task }) {
  const saving = isTempId(task.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', status: task.status },
    disabled: saving,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !isDragging && event.target === event.currentTarget) {
      event.preventDefault();
      if (!saving) openTask(task.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  // The menu button is a sibling of the draggable `role="button"` element, not a child, so no
  // interactive control is nested inside another (axe: nested-interactive). The card's accessible
  // name comes from its content (title, priority, due date), matching what is visible.
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="group/sortable relative shrink-0"
    >
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
        onClick={() => {
          if (!saving) openTask(task.id);
        }}
        aria-disabled={saving || undefined}
        data-task-id={task.id}
        className={cn(
          'touch-manipulation rounded-md outline-offset-2 select-none',
          saving ? 'cursor-progress opacity-75' : 'cursor-grab active:cursor-grabbing',
        )}
      >
        {isDragging ? (
          <div aria-hidden className="relative">
            <div className="invisible">
              <TaskCardBody task={task} />
            </div>
            <div className="absolute inset-0 rounded-md border-[1.5px] border-dashed border-border-strong bg-black/[0.025]" />
          </div>
        ) : (
          <TaskCardBody task={task} />
        )}
      </div>
      {!isDragging && !saving && <CardMenu task={task} />}
    </div>
  );
});
