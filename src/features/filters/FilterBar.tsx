import { ChevronDown, ListFilter, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useMediaQuery } from '@/app/useMediaQuery';
import { Button, Kbd } from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { cn } from '@/lib/cn';
import { useFilterState, type FilterGroupState, type FilterState } from './useFilterState';

const MOBILE_QUERY = '(max-width: 639.98px)';

/** Toolbar trigger: compact outlined button, highlighted while its filters are active. */
const triggerClass =
  'inline-flex h-8 shrink-0 select-none items-center gap-1.5 rounded-md border border-border bg-card px-2.5 ' +
  'text-[13px] leading-5 font-medium text-secondary shadow-card transition-[background-color,border-color,color] duration-150 ' +
  'hover:border-border-strong hover:bg-hover hover:text-primary ' +
  'data-[state=open]:border-border-strong data-[state=open]:bg-hover data-[state=open]:text-primary ' +
  'data-active:text-primary [&_svg]:size-3.5 [&_svg]:shrink-0';

/** True when `/` should be left alone: typing in a field, or focus is in a menu / dialog. */
function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select, [role="menu"], [role="dialog"]') !== null)
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[11px] leading-none font-semibold text-on-accent tabular-nums"
    >
      {count}
    </span>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10 ring-inset"
      style={{ backgroundColor: color }}
    />
  );
}

/** Search box: `/` focuses it from anywhere, Esc clears it and leaves the field. */
function SearchField({ q, onChange }: { q: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (q !== '') onChange('');
    event.currentTarget.blur();
  };

  return (
    <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        aria-label="Search tasks"
        aria-keyshortcuts="/"
        placeholder="Search tasks…"
        autoComplete="off"
        spellCheck={false}
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          'peer h-8 w-full rounded-md border border-border bg-card pr-8 pl-8 text-[13px] leading-5 text-primary shadow-card',
          'transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted hover:border-border-strong',
          'focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/20 focus-visible:outline-none',
        )}
      />
      {q !== '' ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-subtle hover:bg-hover hover:text-primary"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : (
        <Kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 peer-focus:hidden max-sm:hidden"
        >
          /
        </Kbd>
      )}
    </div>
  );
}

/** One group's checkbox list with a "Clear" link. Used in the group popover and on mobile. */
function GroupOptions({ state }: { state: FilterGroupState }) {
  const headingId = useId();
  const { group, options, selected, toggle, clear } = state;

  return (
    <div>
      <div className="flex h-7 items-center justify-between gap-4 pr-1 pl-2">
        <span id={headingId} className="text-meta text-subtle">
          {group.label}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={selected.length === 0}
          aria-label={`Clear ${group.label} filter`}
          className="rounded-sm px-1 text-meta text-accent-text hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          Clear
        </button>
      </div>
      {options.length === 0 ? (
        <p className="px-2 py-1.5 text-meta text-subtle">Nothing to filter by yet</p>
      ) : (
        <ul role="group" aria-labelledby={headingId}>
          {options.map((option) => (
            <li key={option.id}>
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 select-none hover:bg-hover has-focus-visible:bg-hover">
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={() => toggle(option.id)}
                  className="size-3.5 shrink-0 cursor-pointer accent-accent focus-visible:outline-offset-1"
                />
                {option.color && <Swatch color={option.color} />}
                <span className="truncate">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Priority ▾" toolbar button + popover. */
function GroupButton({ state }: { state: FilterGroupState }) {
  const count = state.selected.length;
  return (
    <Popover>
      <PopoverTrigger className={triggerClass} data-active={count > 0 || undefined}>
        {state.group.label}
        {count > 0 && (
          <>
            <CountBadge count={count} />
            <span className="sr-only">, {count} selected</span>
          </>
        )}
        <ChevronDown aria-hidden className="text-subtle" />
      </PopoverTrigger>
      <PopoverContent aria-label={`Filter by ${state.group.label}`} className="w-56">
        <GroupOptions state={state} />
      </PopoverContent>
    </Popover>
  );
}

/** Removable "Priority: High ×" chips for every active selection. */
function ActiveChips({ groups }: { groups: FilterGroupState[] }) {
  return groups.flatMap(({ group, options, selected, toggle }) =>
    options
      .filter((o) => selected.includes(o.id))
      .map((option) => (
        <span
          key={`${group.key}:${option.id}`}
          className="inline-flex h-7 max-w-56 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card pr-0.5 pl-2 text-[13px] leading-5 shadow-card"
        >
          <span className="text-subtle">{group.label}:</span>
          {option.color && <Swatch color={option.color} />}
          <span className="truncate font-medium text-primary">{option.label}</span>
          <button
            type="button"
            aria-label={`Remove filter ${group.label}: ${option.label}`}
            onClick={() => toggle(option.id)}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-subtle hover:bg-hover hover:text-primary"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      )),
  );
}

/** Below 640 px: every group behind one "Filters" button. */
function MobileFilters({ state }: { state: FilterState }) {
  const { groups, activeCount, clearAll } = state;
  if (groups.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger className={triggerClass} data-active={activeCount > 0 || undefined}>
        <ListFilter aria-hidden />
        Filters
        {activeCount > 0 && (
          <>
            <CountBadge count={activeCount} />
            <span className="sr-only">, {activeCount} active</span>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent
        aria-label="Filters"
        align="end"
        className="w-[min(18rem,calc(100vw-2rem))] p-0"
      >
        <div className="divide-y divide-border">
          {groups.map((g) => (
            <div key={g.group.key} className="p-1">
              <GroupOptions state={g} />
            </div>
          ))}
        </div>
        <div className="border-t border-border p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={!state.isFiltering}
            className="w-full"
          >
            Clear filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Toolbar row (DESIGN §7.1): search, one popover per filter group, active chips. */
export function FilterBar() {
  const state = useFilterState();
  const isMobile = useMediaQuery(MOBILE_QUERY);

  return (
    <div
      role="group"
      aria-label="Search and filters"
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
    >
      <SearchField q={state.q} onChange={state.setQ} />
      {isMobile ? (
        <MobileFilters state={state} />
      ) : (
        <>
          {state.groups.map((g) => (
            <GroupButton key={g.group.key} state={g} />
          ))}
          {state.activeCount > 0 && (
            <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
          )}
          <ActiveChips groups={state.groups} />
          {state.isFiltering && (
            <Button variant="ghost" size="sm" leadingIcon={<X />} onClick={state.clearAll}>
              Clear filters
            </Button>
          )}
        </>
      )}
    </div>
  );
}
