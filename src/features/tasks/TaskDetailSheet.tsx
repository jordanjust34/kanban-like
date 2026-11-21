import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  CalendarDays,
  CircleDashed,
  FileQuestion,
  Flag,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useId, useState, type ReactNode } from 'react';
import { Button, EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/Sheet';
import { TaskFeed } from '@/features/activity/TaskFeed';
import { LabelField } from '@/features/labels/LabelField';
import { AssigneeField } from '@/features/members/AssigneeField';
import { setSearchParams } from '@/lib/urlState';
import { useDeleteTask, useMoveTask, useTasks, useUpdateTask } from './api';
import { describeError } from './errors';
import { DescriptionField } from './sheet/DescriptionField';
import { DueDateInput, PrioritySelect, StatusSelect } from './sheet/fields';
import { InlineTitle } from './sheet/InlineTitle';
import { PropertyRow } from './sheet/PropertyRow';
import { useFollowTempId } from './sheet/useFollowTempId';
import { useSaveState } from './sheet/useSaveState';
import { isTempId } from './taskList';
import type { Task } from './types';

export type TaskDetailSheetProps = {
  open: boolean;
  taskId: string;
  onClose: () => void;
};

/** Fields that handle Esc themselves (revert / leave the field) carry `data-esc-local`. */
function isLocalEscTarget(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && active.closest('[data-esc-local]') !== null;
}

/**
 * Task detail (DESIGN §7.4, FR-T3/T4): right-side sheet, full-screen on phones. Opened by
 * `?task=<id>`; every edit goes through the optimistic task API, so the board updates at once.
 */
export function TaskDetailSheet({ open, taskId, onClose }: TaskDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (isLocalEscTarget()) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          // Back to the card, wherever it is now (a status change remounts it in another column).
          const card = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
          if (card) {
            event.preventDefault();
            card.focus({ preventScroll: false });
          }
        }}
      >
        <SheetBody open={open} taskId={taskId} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ open, taskId, onClose }: TaskDetailSheetProps) {
  const query = useTasks();
  const tasks = query.data;
  const found = tasks?.find((t) => t.id === taskId);

  // Keep showing the last version while the sheet animates out (e.g. right after Delete).
  const [last, setLast] = useState<Task | undefined>(found);
  if (found && found !== last) setLast(found);
  const task = found ?? (!open && last?.id === taskId ? last : undefined);

  const followRealId = useCallback(
    (realId: string) => setSearchParams({ task: realId }, 'replace'),
    [],
  );
  useFollowTempId(taskId, tasks, followRealId);

  if (task) return <TaskDetails key={task.id} task={task} onClose={onClose} />;
  if (tasks === undefined && query.isError) {
    return (
      <SheetFrame>
        <ErrorState
          title="Couldn't load this task"
          reason={describeError(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          className="my-auto"
        />
      </SheetFrame>
    );
  }
  if (tasks === undefined) return <SheetSkeleton />;
  return (
    <SheetFrame>
      <EmptyState
        icon={<FileQuestion />}
        title="Task not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
        className="my-auto"
      />
    </SheetFrame>
  );
}

/**
 * Chrome for the non-task states: a close button and a centred body. The dialog's accessible
 * name stays generic; the visible heading inside says what happened.
 */
function SheetFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <SheetTitle className="sr-only">Task</SheetTitle>
      <SheetHeader />
      <div className="flex min-h-0 flex-1 flex-col px-6 pb-16">{children}</div>
    </>
  );
}

function SheetHeader({ saving = false }: { saving?: boolean }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 sm:px-5">
      <span className="text-[13px] leading-5 font-medium text-subtle">Task</span>
      {saving && (
        <span className="inline-flex items-center gap-1.5 text-meta text-subtle">
          <Spinner size={11} /> Creating…
        </span>
      )}
      <SheetClose asChild>
        <Button variant="ghost" size="sm" icon={<X />} aria-label="Close" className="ml-auto" />
      </SheetClose>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <>
      <SheetTitle className="sr-only">Loading task</SheetTitle>
      <SheetHeader />
      <div className="flex flex-col gap-5 px-6 pt-6" aria-busy="true">
        <Skeleton className="h-7 w-3/4" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[7.5rem_1fr] gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    </>
  );
}

function relative(iso: string): string {
  const date = parseISO(iso);
  if (Date.now() - date.getTime() < 60_000) return 'just now';
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function TaskDetails({ task, onClose }: { task: Task; onClose: () => void }) {
  const update = useUpdateTask();
  const move = useMoveTask();
  const remove = useDeleteTask();
  const description = useSaveState(task.id, 'description');
  const pending = isTempId(task.id);
  const ids = { status: useId(), priority: useId(), due: useId() };

  return (
    <>
      <SheetTitle className="sr-only">{task.title}</SheetTitle>
      <SheetHeader saving={pending} />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
        <div className="px-6 pt-5 pb-6">
          <InlineTitle
            value={task.title}
            disabled={pending}
            onSave={(title) => update(task.id, { title })}
          />

          <div className="mt-4 flex flex-col">
            <PropertyRow label="Status" icon={<CircleDashed />} htmlFor={ids.status}>
              <StatusSelect
                id={ids.status}
                value={task.status}
                disabled={pending}
                onChange={(status) => move({ id: task.id, status })}
              />
            </PropertyRow>
            <PropertyRow label="Priority" icon={<Flag />} htmlFor={ids.priority}>
              <PrioritySelect
                id={ids.priority}
                value={task.priority}
                disabled={pending}
                onChange={(priority) => update(task.id, { priority })}
              />
            </PropertyRow>
            <PropertyRow label="Due date" icon={<CalendarDays />} htmlFor={ids.due}>
              <DueDateInput
                id={ids.due}
                value={task.due_date}
                disabled={pending}
                onChange={(due_date) => update(task.id, { due_date })}
              />
            </PropertyRow>
            <PropertyRow label="Assignees" icon={<Users />}>
              <AssigneeField task={task} />
            </PropertyRow>
            <PropertyRow label="Labels" icon={<Tag />}>
              <LabelField task={task} />
            </PropertyRow>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <DescriptionField
              value={task.description}
              disabled={pending}
              saveState={description.state}
              onSave={(next) => description.track(() => update(task.id, { description: next }))}
            />
          </div>

          <div className="mt-6 border-t border-border pt-5 empty:hidden">
            <TaskFeed taskId={task.id} />
          </div>
        </div>
      </div>

      <div className="flex min-h-13 shrink-0 items-center gap-3 border-t border-border px-4 py-2 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-meta text-subtle tabular-nums">
          <span title={new Date(task.created_at).toLocaleString()}>
            Created {relative(task.created_at)}
          </span>
          <span aria-hidden> · </span>
          <span title={new Date(task.updated_at).toLocaleString()}>
            Updated {relative(task.updated_at)}
          </span>
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            remove(task);
            onClose();
          }}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] leading-5 font-medium text-danger-text transition-colors duration-150 enabled:hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4"
        >
          <Trash2 aria-hidden />
          Delete
        </button>
      </div>
    </>
  );
}
