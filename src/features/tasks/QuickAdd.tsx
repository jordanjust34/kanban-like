import { CornerDownLeft } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Kbd } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LIMITS, STATUS_BY_VALUE, type Status } from '@/lib/domain';

export type QuickAddProps = {
  status: Status;
  /** Called with the trimmed title. The form stays open for the next task. */
  onCreate: (title: string) => void;
  onClose: () => void;
};

const EMPTY_MESSAGE = 'Give the task a title.';

/**
 * Inline per-column task creation (D13). Enter saves and stays open; Esc, or blurring while
 * empty, closes. Whitespace-only titles are rejected inline (FR-T1).
 */
export function QuickAdd({ status, onCreate, onClose }: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const label = STATUS_BY_VALUE[status].label;
  const remaining = LIMITS.taskTitle - title.length;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(EMPTY_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    onCreate(trimmed);
    setTitle('');
    setError(null);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className={cn(
        'shrink-0 rounded-md bg-card p-2 shadow-card ring-1 transition-shadow duration-150',
        error ? 'ring-danger/60' : 'ring-accent/45',
      )}
    >
      <textarea
        ref={inputRef}
        autoFocus
        rows={2}
        value={title}
        maxLength={LIMITS.taskTitle}
        placeholder="Task title"
        aria-label={`New task in ${label}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          // Titles are single-line: pasted line breaks become spaces.
          setTitle(event.target.value.replace(/[\r\n]+/g, ' '));
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!title.trim()) onClose();
        }}
        className="block max-h-40 min-h-10 w-full resize-none bg-transparent px-1 py-0.5 text-card-title text-primary outline-none placeholder:font-normal placeholder:text-muted [field-sizing:content] focus-visible:outline-none"
      />

      {error && (
        <p id={errorId} role="alert" className="px-1 pt-1 text-meta text-danger-text">
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="hidden items-center gap-1 pl-1 text-meta whitespace-nowrap text-subtle sm:inline-flex">
          <Kbd aria-hidden>
            <CornerDownLeft className="size-3" />
          </Kbd>
          <span className="sr-only">Enter</span>
          add
          <Kbd className="ml-1">Esc</Kbd>
          close
        </span>
        {remaining <= 20 && (
          <span className="text-meta text-subtle tabular-nums" aria-live="polite">
            {remaining}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            // Keep focus in the textarea so blur doesn't close the form first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={submit}
          >
            Add task
          </Button>
        </div>
      </div>
    </div>
  );
}
