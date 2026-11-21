import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowRight, ChevronRight, Ellipsis, PanelRightOpen, Trash2 } from 'lucide-react';
import type { SyntheticEvent } from 'react';
import { STATUSES } from '@/lib/domain';
import { cn } from '@/lib/cn';
import { openTask } from '@/lib/urlState';
import type { Task } from '@/features/tasks/types';
import { useBoardActions } from './BoardActions';

const contentClass =
  'z-50 min-w-44 rounded-md border border-border bg-card p-1 text-[13px] leading-5 text-primary shadow-popover ' +
  'origin-(--radix-dropdown-menu-content-transform-origin) transition-[opacity,scale] duration-150 ease-out ' +
  'starting:scale-95 starting:opacity-0';

const itemClass =
  'flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-2 outline-none ' +
  'data-highlighted:bg-hover data-[state=open]:bg-hover [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle';

/** Keeps pointer / key events on the menu from reaching the card (drag start, open on Enter). */
const stop = (event: SyntheticEvent) => event.stopPropagation();

/** Menu content is portalled, but React events still bubble to the card through the tree. */
const stopAll = { onClick: stop, onKeyDown: stop, onPointerDown: stop };

/** The card's "⋯" quick menu: open, move to another column, delete. */
export function CardMenu({ task }: { task: Task }) {
  const { moveToColumn, deleteTask } = useBoardActions();

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${task.title}`}
        onPointerDown={stop}
        onKeyDown={stop}
        onClick={stop}
        className={cn(
          'absolute top-2 right-2 flex size-6 items-center justify-center rounded-sm text-subtle',
          'opacity-0 transition-[opacity,background-color,color] duration-150',
          'group-hover/card:opacity-100 group-focus-within/card:opacity-100 focus-visible:opacity-100',
          'hover:bg-black/5 hover:text-primary data-[state=open]:bg-black/5 data-[state=open]:text-primary data-[state=open]:opacity-100',
          'pointer-coarse:opacity-100',
        )}
      >
        <Ellipsis aria-hidden className="size-4" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className={contentClass}
          {...stopAll}
        >
          <DropdownMenu.Item className={itemClass} onSelect={() => openTask(task.id)}>
            <PanelRightOpen aria-hidden />
            Open
          </DropdownMenu.Item>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemClass}>
              <ArrowRight aria-hidden />
              Move to
              <ChevronRight aria-hidden className="ml-auto" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={6}
                collisionPadding={8}
                className={contentClass}
                {...stopAll}
              >
                {STATUSES.filter((s) => s.value !== task.status).map((s) => (
                  <DropdownMenu.Item
                    key={s.value}
                    className={itemClass}
                    onSelect={() => moveToColumn(task, s.value)}
                  >
                    <span
                      aria-hidden
                      className="mx-1 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.accent }}
                    />
                    {s.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />

          <DropdownMenu.Item
            className={cn(
              itemClass,
              'text-danger-text data-highlighted:bg-danger-soft [&_svg]:text-danger-text',
            )}
            onSelect={() => deleteTask(task)}
          >
            <Trash2 aria-hidden />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
