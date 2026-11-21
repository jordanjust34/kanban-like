import { AlertCircle, Check } from 'lucide-react';
import { useId, useState } from 'react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LIMITS } from '@/lib/domain';
import type { SaveState } from './useSaveState';

export type DescriptionFieldProps = {
  value: string | null;
  disabled?: boolean;
  saveState: SaveState;
  /** Called on blur with the trimmed text (`null` when empty), only when it changed. */
  onSave: (description: string | null) => void;
};

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 text-meta transition-opacity duration-200',
        state === 'idle' ? 'opacity-0' : 'opacity-100',
        state === 'error' ? 'text-danger-text' : 'text-subtle',
      )}
    >
      {state === 'saving' && (
        <>
          <Spinner size={11} /> Saving…
        </>
      )}
      {state === 'saved' && (
        <>
          <Check aria-hidden className="size-3" /> Saved
        </>
      )}
      {state === 'error' && (
        <>
          <AlertCircle aria-hidden className="size-3" /> Not saved
        </>
      )}
    </span>
  );
}

/**
 * Plain-text description (DESIGN §7.4). Holds a draft only while focused; autosaves on blur when
 * the text changed. Esc leaves the field (saving) instead of closing the sheet.
 */
export function DescriptionField({ value, disabled, saveState, onSave }: DescriptionFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const shown = draft ?? value ?? '';
  const remaining = LIMITS.taskDescription - shown.length;

  const commit = () => {
    if (draft === null) return;
    const next = draft.trim() || null;
    setDraft(null);
    if (next !== (value ?? null)) onSave(next);
  };

  return (
    <div>
      <div className="mb-1.5 flex h-5 items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-secondary">
          Description
        </label>
        <div className="flex items-center gap-3">
          {draft !== null && remaining <= 200 && (
            <span className="text-meta text-subtle tabular-nums">{remaining}</span>
          )}
          <SaveIndicator state={saveState} />
        </div>
      </div>
      <textarea
        id={id}
        data-esc-local
        value={shown}
        disabled={disabled}
        maxLength={LIMITS.taskDescription}
        placeholder="Add a description…"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className={cn(
          '-mx-2 block min-h-24 w-[calc(100%+16px)] resize-none rounded-sm bg-transparent px-2 py-1.5 [field-sizing:content]',
          'text-body break-words whitespace-pre-wrap text-primary placeholder:text-muted',
          'transition-[background-color,box-shadow] duration-150 outline-none',
          'hover:bg-hover focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-accent/20 focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-accent',
          'disabled:cursor-progress disabled:hover:bg-transparent',
        )}
      />
    </div>
  );
}
