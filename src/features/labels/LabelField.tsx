import { useCallback, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { isTempId } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import { cn } from '@/lib/cn';
import { useLabelsForTask } from './api';
import { LabelChip } from './LabelChip';
import { LabelPicker, type PickerMode } from './LabelPicker';

const LIST: PickerMode = { kind: 'list' };

/**
 * Value cell of the sheet's "Labels" row: the task's chips (or "Add label") as a trigger that
 * opens the label picker. Always renders, so the row never hides; disabled while the task is
 * still being created (temp id).
 */
export function LabelField({ task }: { task: Task }) {
  const labels = useLabelsForTask(task.id);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>(LIST);
  const disabled = isTempId(task.id);
  const contentRef = useRef<HTMLDivElement>(null);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setMode(LIST);
  }, []);

  return (
    <Popover open={open && !disabled} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={
            labels.length > 0 ? `Labels: ${labels.map((l) => l.name).join(', ')}` : 'Add label'
          }
          className={cn(
            'flex min-h-8 w-full flex-wrap items-center gap-1 rounded-sm px-2 py-1.5 text-left text-[13px] leading-5',
            'transition-[background-color] duration-150 hover:bg-hover focus-visible:bg-hover',
            'outline-accent focus-visible:outline-2 focus-visible:outline-offset-0',
            'disabled:pointer-events-none disabled:opacity-60',
          )}
        >
          {labels.length > 0 ? (
            labels.map((l) => <LabelChip key={l.id} name={l.name} color={l.color} />)
          ) : (
            <span className="text-subtle">Add label</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        aria-label="Labels"
        className="w-72 p-0"
        onEscapeKeyDown={(event) => {
          // Esc first leaves an inline edit / delete confirm, then closes the popover.
          if (mode.kind !== 'list') {
            event.preventDefault();
            const id = mode.id;
            setMode(LIST);
            requestAnimationFrame(() =>
              contentRef.current
                ?.querySelector<HTMLElement>(`[data-label-row="${id}"] [data-picker-item]`)
                ?.focus(),
            );
          }
        }}
      >
        <LabelPicker task={task} mode={mode} onModeChange={setMode} />
      </PopoverContent>
    </Popover>
  );
}
