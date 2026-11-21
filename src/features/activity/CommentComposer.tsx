import { ArrowUp } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LIMITS } from '@/lib/domain';
import { commentBody } from './model';

/** Show the remaining-characters counter from this many characters before the limit. */
const COUNTER_FROM = 200;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export type CommentComposerProps = {
  disabled?: boolean;
  /** Returns whether the comment was accepted (the draft clears only then). */
  onSend: (body: string) => boolean;
};

/**
 * Comment box at the end of the feed (DESIGN §7.4). Auto-grows; ⌘/Ctrl+Enter sends, Enter is a
 * newline. Esc leaves the field first (`data-esc-local`), so a second Esc closes the sheet.
 */
export function CommentComposer({ disabled = false, onSend }: CommentComposerProps) {
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const hintId = useId();
  const remaining = LIMITS.commentBody - draft.length;
  const canSend = !disabled && commentBody(draft) !== null;

  const send = () => {
    if (!canSend || !onSend(draft)) return;
    setDraft('');
    ref.current?.focus();
  };

  return (
    <form
      className={cn(
        'rounded-md border border-border bg-card shadow-card transition-[border-color,box-shadow] duration-150',
        'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Comment
      </label>
      <textarea
        ref={ref}
        id={id}
        data-esc-local
        rows={2}
        value={draft}
        disabled={disabled}
        maxLength={LIMITS.commentBody}
        placeholder="Leave a comment…"
        aria-describedby={hintId}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
        className={cn(
          'block max-h-60 min-h-16 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 [field-sizing:content]',
          'text-body break-words whitespace-pre-wrap text-primary outline-none placeholder:text-subtle',
          'disabled:cursor-not-allowed',
        )}
      />
      <div className="flex items-center justify-end gap-3 px-2 pb-2">
        <span id={hintId} className="mr-auto pl-1 text-meta text-subtle">
          {remaining <= COUNTER_FROM ? (
            <span className={cn('tabular-nums', remaining <= 0 && 'text-danger-text')}>
              {remaining} characters left
            </span>
          ) : (
            <span className="max-sm:sr-only">{isMac ? '⌘' : 'Ctrl'}+Enter to send</span>
          )}
        </span>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          icon={<ArrowUp />}
          aria-label="Send comment"
          title={`Send (${isMac ? '⌘' : 'Ctrl'}+Enter)`}
          disabled={!canSend}
        />
      </div>
    </form>
  );
}
