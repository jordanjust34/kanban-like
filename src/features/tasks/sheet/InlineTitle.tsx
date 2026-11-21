import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { LIMITS } from '@/lib/domain';

export type InlineTitleProps = {
  value: string;
  disabled?: boolean;
  /** Called with the trimmed title, only when it changed. */
  onSave: (title: string) => void;
};

/**
 * Heading that is a textarea in disguise. Holds a draft only while being edited, so the shown
 * title follows the cache otherwise. Enter / blur saves, Esc reverts, empty is rejected.
 * `data-esc-local` tells the sheet not to close on that Esc.
 */
export function InlineTitle({ value, disabled, onSave }: InlineTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const errorId = useId();
  /** Set by Esc so the blur that follows doesn't save the abandoned draft. */
  const reverting = useRef(false);

  const commit = (): boolean => {
    if (draft === null) return true;
    const next = draft.trim();
    if (!next) return false;
    setDraft(null);
    setError(false);
    if (next !== value) onSave(next);
    return true;
  };

  const revert = () => {
    setDraft(null);
    setError(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (commit()) event.currentTarget.blur();
      else setError(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      revert();
      reverting.current = true;
      event.currentTarget.blur();
      reverting.current = false;
    }
  };

  return (
    <div>
      <textarea
        data-esc-local
        rows={1}
        aria-label="Task title"
        value={draft ?? value}
        disabled={disabled}
        maxLength={LIMITS.taskTitle}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          // Titles are single-line: pasted line breaks become spaces.
          setDraft(event.target.value.replace(/[\r\n]+/g, ' '));
          if (error) setError(false);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (reverting.current) return;
          // Blurring with an empty title quietly restores the saved one.
          if (!commit()) revert();
        }}
        className={cn(
          '-mx-2 block w-[calc(100%+16px)] resize-none rounded-sm bg-transparent px-2 py-1 [field-sizing:content]',
          'text-[20px] leading-7 font-semibold tracking-[-0.015em] text-primary break-words',
          'transition-[background-color,box-shadow] duration-150 outline-none',
          'hover:bg-hover focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-accent/20 focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-accent',
          'disabled:cursor-progress disabled:hover:bg-transparent',
          error && 'focus-visible:outline-danger focus-visible:ring-danger/20',
        )}
      />
      {error && (
        <p id={errorId} role="alert" className="pt-1 text-meta text-danger-text">
          The title can’t be empty. Press Esc to undo.
        </p>
      )}
    </div>
  );
}
