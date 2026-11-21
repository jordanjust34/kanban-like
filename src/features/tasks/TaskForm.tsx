import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';
import { DEFAULT_PRIORITY, LIMITS, type Priority, type Status } from '@/lib/domain';
import type { CreateTaskInput } from './api';
import { DueDateInput, PrioritySelect, StatusSelect } from './sheet/fields';

export type TaskFormValues = CreateTaskInput & {
  priority: Priority;
  description: string | null;
  due_date: string | null;
};

export type TaskFormProps = {
  /** Column the task starts in (from `?new=<status>`). */
  initialStatus: Status;
  /** Called with trimmed values; empty description / due date are `null`. */
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
};

const EMPTY_TITLE = 'Give the task a title.';

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);

/**
 * Full create form (D13, FR-T1/T2): title (required), description, status, priority, due date.
 * Enter in the title or ⌘/Ctrl+Enter anywhere submits.
 */
export function TaskForm({ initialStatus, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>(initialStatus);
  const [priority, setPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), error: useId(), description: useId() };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(EMPTY_TITLE);
      titleRef.current?.focus();
      return;
    }
    onSubmit({
      title: trimmed,
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate,
    });
  };

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (
      event.key === 'Enter' &&
      (event.metaKey || event.ctrlKey) &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      noValidate
      onSubmit={onFormSubmit}
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-col"
    >
      <div className="min-h-0 overflow-y-auto px-5 pb-4 scrollbar-thin">
        <label htmlFor={ids.title} className="sr-only">
          Title
        </label>
        <input
          ref={titleRef}
          id={ids.title}
          autoFocus
          value={title}
          maxLength={LIMITS.taskTitle}
          placeholder="Task title"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.error : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
          className={cn(
            'block w-full bg-transparent py-1 text-[18px] leading-7 font-semibold tracking-[-0.01em] text-primary outline-none',
            'placeholder:font-medium placeholder:text-muted focus-visible:outline-none',
          )}
        />
        {error && (
          <p id={ids.error} role="alert" className="pt-0.5 text-meta text-danger-text">
            {error}
          </p>
        )}

        <label htmlFor={ids.description} className="sr-only">
          Description
        </label>
        <textarea
          id={ids.description}
          value={description}
          maxLength={LIMITS.taskDescription}
          placeholder="Add a description…"
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-2 block max-h-64 min-h-[66px] w-full resize-none bg-transparent text-body text-primary outline-none [field-sizing:content] placeholder:text-muted focus-visible:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusSelect variant="chip" aria-label="Status" value={status} onChange={setStatus} />
          <PrioritySelect
            variant="chip"
            aria-label="Priority"
            value={priority}
            onChange={setPriority}
          />
          <DueDateInput
            variant="chip"
            aria-label="Due date"
            placeholder="Due date"
            value={dueDate}
            onChange={setDueDate}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-app/60 px-5 py-3">
        <span className="hidden items-center gap-1 text-meta text-subtle sm:inline-flex">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>Enter</Kbd>
          <span className="ml-0.5">to create</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Create task
          </Button>
        </div>
      </div>
    </form>
  );
}
