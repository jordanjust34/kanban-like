import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button, Input, SwatchPicker } from '@/components/ui';
import { isTempId } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import { cn } from '@/lib/cn';
import {
  useCreateLabel,
  useDeleteLabel,
  useLabels,
  useTaskLabelLinks,
  useTaskLabels,
  useToggleTaskLabel,
  useUpdateLabel,
} from './api';
import {
  countTasksByLabel,
  findLabelByName,
  nextLabelColor,
  validateLabelName,
  type Label,
} from './labelList';

export type PickerMode =
  | { kind: 'list' }
  | { kind: 'edit'; id: string; name: string; color: string; error: string | null }
  | { kind: 'delete'; id: string };

type Props = {
  task: Task;
  mode: PickerMode;
  onModeChange: (mode: PickerMode) => void;
};

const NO_LABELS: Label[] = [];
const NO_IDS: readonly string[] = [];

/** Moves focus between `[data-picker-item]`s (and back up to the search box) with ↑ / ↓. */
function moveFocus(container: HTMLElement | null, from: Element | null, step: 1 | -1) {
  if (!container) return;
  const items = [...container.querySelectorAll<HTMLElement>('[data-picker-item]')];
  if (items.length === 0) return;
  const index = from ? items.indexOf(from as HTMLElement) : -1;
  const next = index + step;
  if (next < 0) container.querySelector<HTMLElement>('[data-picker-search]')?.focus();
  else items[Math.min(next, items.length - 1)]?.focus();
}

function taskCount(n: number): string {
  if (n === 0) return "It isn't on any tasks.";
  return `It's on ${n} task${n === 1 ? '' : 's'}.`;
}

/**
 * Popover body of `LabelField`: search / create box, a checkbox per label (toggles at once),
 * and per-label inline Edit (rename + recolor) and Delete (with confirm).
 */
export function LabelPicker({ task, mode, onModeChange }: Props) {
  const { data: labels = NO_LABELS } = useLabels();
  const { data: map } = useTaskLabels();
  const { data: links } = useTaskLabelLinks();
  const toggle = useToggleTaskLabel();
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const remove = useDeleteLabel();

  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const selected = map?.get(task.id) ?? NO_IDS;
  const counts = useMemo(() => countTasksByLabel(links ?? []), [links]);
  const trimmed = query.trim();
  const visible = useMemo(() => {
    const q = trimmed.toLocaleLowerCase();
    return q ? labels.filter((l) => l.name.toLocaleLowerCase().includes(q)) : labels;
  }, [labels, trimmed]);
  const exact = trimmed ? findLabelByName(labels, trimmed) : undefined;
  const showCreate = trimmed !== '' && !exact;

  const focusSearch = () => requestAnimationFrame(() => searchRef.current?.focus());
  const focusRow = (id: string) =>
    requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-label-row="${id}"] [data-picker-item]`)
        ?.focus(),
    );

  const submitCreate = () => {
    if (exact) {
      toggle(task.id, exact.id, true);
      setQuery('');
      return;
    }
    const check = validateLabelName(query, labels);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setQuery('');
    setError(null);
    void create({ name: check.name, color: nextLabelColor(labels) }, task.id).then((result) => {
      if (!result.ok && result.error) {
        setQuery(check.name);
        setError(result.error);
        focusSearch();
      }
    });
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (trimmed) submitCreate();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(rootRef.current, null, 1);
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const target = event.target as HTMLElement;
    if (!target.hasAttribute('data-picker-item')) return;
    event.preventDefault();
    moveFocus(rootRef.current, target, event.key === 'ArrowDown' ? 1 : -1);
  };

  const saveEdit = (label: Label, name: string, color: string) => {
    const check = validateLabelName(name, labels, label.id);
    if (!check.ok) {
      onModeChange({ kind: 'edit', id: label.id, name, color, error: check.error });
      return;
    }
    onModeChange({ kind: 'list' });
    focusRow(label.id);
    const patch: { name?: string; color?: string } = {};
    if (check.name !== label.name) patch.name = check.name;
    if (color !== label.color) patch.color = color;
    if (!patch.name && !patch.color) return;
    void update(label.id, patch).then((result) => {
      if (!result.ok && result.error) {
        onModeChange({ kind: 'edit', id: label.id, name, color, error: result.error });
      }
    });
  };

  return (
    <div ref={rootRef}>
      <div className="border-b border-border p-1.5">
        <Input
          ref={searchRef}
          data-picker-search
          autoFocus
          aria-label="Search or create label"
          placeholder="Search or create label…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
          }}
          onKeyDown={onSearchKeyDown}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-7 border-transparent bg-transparent px-1.5 shadow-none"
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="px-1.5 pt-1 text-[12px] leading-4 text-danger-text"
          >
            {error}
          </p>
        )}
      </div>

      <div role="group" aria-label="Labels" className="p-1" onKeyDown={onListKeyDown}>
        {visible.map((label) => {
          if (mode.kind === 'edit' && mode.id === label.id) {
            return (
              <EditRow
                key={label.id}
                label={label}
                mode={mode}
                onChange={(name, color) => onModeChange({ ...mode, name, color, error: null })}
                onSave={() => saveEdit(label, mode.name, mode.color)}
                onCancel={() => {
                  onModeChange({ kind: 'list' });
                  focusRow(label.id);
                }}
              />
            );
          }
          if (mode.kind === 'delete' && mode.id === label.id) {
            return (
              <ConfirmDelete
                key={label.id}
                label={label}
                count={counts.get(label.id) ?? 0}
                onConfirm={() => {
                  onModeChange({ kind: 'list' });
                  remove(label);
                  focusSearch();
                }}
                onCancel={() => {
                  onModeChange({ kind: 'list' });
                  focusRow(label.id);
                }}
              />
            );
          }
          const saving = isTempId(label.id);
          return (
            <LabelRow
              key={label.id}
              label={label}
              checked={selected.includes(label.id)}
              saving={saving}
              onToggle={(on) => toggle(task.id, label.id, on)}
              onEdit={() =>
                onModeChange({
                  kind: 'edit',
                  id: label.id,
                  name: label.name,
                  color: label.color,
                  error: null,
                })
              }
              onDelete={() => onModeChange({ kind: 'delete', id: label.id })}
            />
          );
        })}

        {showCreate && (
          <button
            type="button"
            data-picker-item
            onClick={submitCreate}
            className={cn(rowClass, 'w-full gap-2 px-2 text-left text-secondary')}
          >
            <Plus aria-hidden className="size-3.5 shrink-0 text-subtle" />
            <span className="truncate">Create “{trimmed}”</span>
          </button>
        )}

        {visible.length === 0 && !showCreate && (
          <p className="px-2 py-1.5 text-subtle">
            {labels.length === 0 ? 'No labels yet. Type to create one.' : 'No matching labels'}
          </p>
        )}
      </div>
    </div>
  );
}

const rowClass =
  'flex h-8 items-center rounded-sm text-[13px] leading-5 outline-accent focus-visible:outline-2 focus-visible:-outline-offset-2 hover:bg-hover';

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-sm text-subtle',
        'transition-colors duration-150 hover:bg-black/5 hover:text-primary',
        'outline-accent focus-visible:outline-2 focus-visible:-outline-offset-2',
        'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5',
      )}
    >
      {children}
    </button>
  );
}

function LabelRow({
  label,
  checked,
  saving,
  onToggle,
  onEdit,
  onDelete,
}: {
  label: Label;
  checked: boolean;
  saving: boolean;
  onToggle: (on: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-label-row={label.id}
      className="group/row flex items-center rounded-sm hover:bg-hover"
    >
      <label
        className={cn(
          'flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 pr-1 pl-2',
          saving && 'cursor-progress',
        )}
      >
        <span className="relative flex size-4 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            data-picker-item
            checked={checked}
            disabled={saving}
            onChange={(event) => onToggle(event.target.checked)}
            className={cn(
              'peer size-4 cursor-pointer appearance-none rounded-[4px] border border-border-strong bg-card',
              'checked:border-accent checked:bg-accent disabled:cursor-progress',
              'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          />
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute size-3 text-on-accent opacity-0 peer-checked:opacity-100"
          />
        </span>
        <Swatch color={label.color} />
        <span className="truncate text-primary">{label.name}</span>
      </label>
      <IconButton label={`Edit ${label.name}`} onClick={onEdit} disabled={saving}>
        <Pencil />
      </IconButton>
      <IconButton label={`Delete ${label.name}`} onClick={onDelete} disabled={saving}>
        <Trash2 />
      </IconButton>
    </div>
  );
}

function EditRow({
  label,
  mode,
  onChange,
  onSave,
  onCancel,
}: {
  label: Label;
  mode: Extract<PickerMode, { kind: 'edit' }>;
  onChange: (name: string, color: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const errorId = useId();
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };
  return (
    <form
      data-label-row={label.id}
      aria-label={`Edit label ${label.name}`}
      onSubmit={onSubmit}
      className="my-0.5 flex flex-col gap-2 rounded-sm bg-hover p-2"
    >
      <Input
        autoFocus
        aria-label="Label name"
        value={mode.name}
        onChange={(event) => onChange(event.target.value, mode.color)}
        aria-invalid={mode.error ? true : undefined}
        aria-describedby={mode.error ? errorId : undefined}
        className="h-7 px-2"
      />
      {mode.error && (
        <p id={errorId} role="alert" className="-mt-1 text-[12px] leading-4 text-danger-text">
          {mode.error}
        </p>
      )}
      <SwatchPicker
        label="Label color"
        value={mode.color}
        onChange={(color) => onChange(mode.name, color)}
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

function ConfirmDelete({
  label,
  count,
  onConfirm,
  onCancel,
}: {
  label: Label;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const textId = useId();
  return (
    <div
      data-label-row={label.id}
      role="group"
      aria-labelledby={textId}
      className="my-0.5 flex flex-col gap-2 rounded-sm bg-hover p-2"
    >
      <p id={textId} className="text-[13px] leading-5 text-primary">
        Delete “{label.name}”? {taskCount(count)}
      </p>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" autoFocus onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="danger" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </div>
  );
}
