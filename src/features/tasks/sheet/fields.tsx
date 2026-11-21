/**
 * Property controls shared by the create dialog and the detail sheet: status, priority and due
 * date. Native `<select>` / `<input type="date">` underneath (keyboard, screen readers and
 * mobile pickers for free), dressed as Linear-style property buttons.
 *
 *   variant="property"  ghost value cell in the sheet's property grid (fills the cell)
 *   variant="chip"      bordered, content-width pill for the create dialog's property row
 */
import { format, isValid, parseISO } from 'date-fns';
import {
  CalendarDays,
  ChevronDown,
  SignalHigh,
  SignalLow,
  SignalMedium,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PRIORITIES, STATUSES, STATUS_BY_VALUE, isPriority, isStatus } from '@/lib/domain';
import type { Priority, Status } from '@/lib/domain';

export type FieldVariant = 'property' | 'chip';

const shell: Record<FieldVariant, string> = {
  property:
    'h-8 w-full rounded-sm text-[13px] leading-5 text-primary ' +
    'hover:bg-hover has-focus-visible:bg-hover',
  chip:
    'h-7 rounded-sm border border-border bg-card text-[12px] leading-4 font-medium text-secondary shadow-[0_1px_1px_rgb(0_0_0/0.03)] ' +
    'hover:border-border-strong hover:text-primary',
};

const control =
  'peer h-full w-full min-w-0 cursor-pointer appearance-none rounded-sm bg-transparent pr-7 pl-7 outline-none ' +
  'text-inherit focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed';

type ShellProps = {
  variant: FieldVariant;
  icon: ReactNode;
  disabled?: boolean;
  /** Right-hand adornment (chevron or clear button). */
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
};

function FieldShell({ variant, icon, disabled, trailing, className, children }: ShellProps) {
  return (
    <div
      className={cn(
        'group/field relative inline-flex items-center transition-[background-color,border-color,color] duration-150',
        shell[variant],
        variant === 'chip' && '[&_select]:[field-sizing:content]',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 flex size-4 items-center justify-center"
      >
        {icon}
      </span>
      {children}
      {trailing}
    </div>
  );
}

/** Select chevron: always shown on chips, revealed on hover / focus in the property grid. */
function Chevron({ variant }: { variant: FieldVariant }) {
  return (
    <ChevronDown
      aria-hidden
      className={cn(
        'pointer-events-none absolute right-2 size-3.5 text-muted transition-opacity duration-150',
        variant === 'property' &&
          'opacity-0 group-hover/field:opacity-100 group-has-focus-visible/field:opacity-100',
      )}
    />
  );
}

/* ────────────────────────────── status ────────────────────────────── */

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('size-2.5 rounded-full ring-2 ring-current/15', className)}
      style={{
        backgroundColor: STATUS_BY_VALUE[status].accent,
        color: STATUS_BY_VALUE[status].accent,
      }}
    />
  );
}

type SelectFieldProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  variant?: FieldVariant;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
};

export function StatusSelect({
  value,
  onChange,
  variant = 'property',
  disabled,
  className,
  ...rest
}: SelectFieldProps<Status>) {
  return (
    <FieldShell
      variant={variant}
      disabled={disabled}
      icon={<StatusDot status={value} />}
      trailing={<Chevron variant={variant} />}
      className={className}
    >
      <select
        {...rest}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          if (isStatus(event.target.value)) onChange(event.target.value);
        }}
        className={control}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/* ───────────────────────────── priority ───────────────────────────── */

const PRIORITY_ICON: Record<Priority, { icon: LucideIcon; className: string }> = {
  high: { icon: SignalHigh, className: 'text-danger-text' },
  normal: { icon: SignalMedium, className: 'text-status-in-progress' },
  low: { icon: SignalLow, className: 'text-subtle' },
};

export function PriorityIcon({ priority }: { priority: Priority }) {
  const { icon: Icon, className } = PRIORITY_ICON[priority];
  return <Icon aria-hidden strokeWidth={2.5} className={cn('size-4', className)} />;
}

export function PrioritySelect({
  value,
  onChange,
  variant = 'property',
  disabled,
  className,
  ...rest
}: SelectFieldProps<Priority>) {
  return (
    <FieldShell
      variant={variant}
      disabled={disabled}
      icon={<PriorityIcon priority={value} />}
      trailing={<Chevron variant={variant} />}
      className={className}
    >
      <select
        {...rest}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          if (isPriority(event.target.value)) onChange(event.target.value);
        }}
        className={control}
      >
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/* ───────────────────────────── due date ───────────────────────────── */

/**
 * Chrome fires `change` on every keystroke of the year segment (0002 → 0020 → 0202 → 2026), so
 * only plausible years are committed while typing; anything else waits for blur.
 */
function isPlausibleDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1900 && year <= 2999 && isValid(parseISO(value));
}

/** "Nov 28, 2026". `YYYY-MM-DD` is parsed as a local date (never `new Date(str)`, see §6). */
function formatDueDate(value: string): string {
  const date = parseISO(value);
  return isValid(date) ? format(date, 'MMM d, yyyy') : value;
}

export type DueDateInputProps = {
  /** `YYYY-MM-DD` or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  variant?: FieldVariant;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Shown while empty. */
  placeholder?: string;
  className?: string;
};

/**
 * Styled native date input. Shows "Nov 28, 2026" (or the placeholder) until focused, opens the
 * browser's picker on click, and has a clear button. While the user types, only complete,
 * plausible dates are reported; a half-typed date is settled (or cleared) on blur.
 */
export function DueDateInput({
  value,
  onChange,
  variant = 'property',
  disabled,
  placeholder = 'No due date',
  className,
  ...rest
}: DueDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  /** Raw input value while the user is mid-edit; null otherwise (the prop wins). */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value ?? '';

  const report = (next: string | null) => {
    if (next !== value) onChange(next);
  };

  return (
    <FieldShell
      variant={variant}
      disabled={disabled}
      icon={<CalendarDays className={cn('size-4', value ? 'text-secondary' : 'text-muted')} />}
      className={cn(variant === 'chip' && 'min-w-[8.5rem]', className)}
      trailing={
        value && !disabled ? (
          <button
            type="button"
            aria-label="Clear due date"
            onClick={() => {
              setDraft(null);
              report(null);
            }}
            className="absolute right-1 flex size-6 items-center justify-center rounded-[4px] text-muted transition-colors duration-150 hover:bg-black/5 hover:text-primary"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null
      }
    >
      <input
        {...rest}
        ref={inputRef}
        type="date"
        value={shown}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft !== null) {
            if (draft === '') report(null);
            else if (isPlausibleDate(draft)) report(draft);
            setDraft(null);
          }
        }}
        onClick={() => {
          const input = inputRef.current;
          if (input && typeof input.showPicker === 'function') {
            try {
              input.showPicker();
            } catch {
              // Not allowed (e.g. no user activation): the input still works by keyboard.
            }
          }
        }}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (isPlausibleDate(next)) report(next);
        }}
        className={cn(
          control,
          'pr-8 tabular-nums [&::-webkit-calendar-picker-indicator]:hidden',
          !focused && 'text-transparent',
        )}
      />
      {!focused && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-7 flex items-center truncate tabular-nums',
            value ? 'text-inherit' : 'text-muted',
          )}
        >
          {value ? formatDueDate(value) : placeholder}
        </span>
      )}
    </FieldShell>
  );
}
