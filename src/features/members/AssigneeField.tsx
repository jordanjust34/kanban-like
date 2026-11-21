import { ChevronLeft, Settings2, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { isTempId } from '@/features/tasks/taskList';
import type { Task } from '@/features/tasks/types';
import { cn } from '@/lib/cn';
import { useMembers, useTaskAssignees, useToggleAssignee } from './api';
import { Avatar, AvatarStack } from './Avatar';
import { TeamManager } from './TeamManager';
import { useTaskMembers } from './useTaskMembers';

/** Above this many members the picker gets a quick filter input. */
const FILTER_THRESHOLD = 6;

const triggerClass =
  'flex h-8 w-full min-w-0 items-center rounded-sm px-2 text-left text-[13px] leading-5 text-primary ' +
  'transition-colors duration-150 hover:bg-hover data-[state=open]:bg-hover ' +
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent ' +
  'disabled:pointer-events-none disabled:opacity-60';

const rowClass =
  'flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left select-none hover:bg-hover has-focus-visible:bg-hover';

const linkClass = cn(
  rowClass,
  'text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-accent',
);

function Picker({
  task,
  onManage,
  focusManage,
}: {
  task: Task;
  onManage: () => void;
  focusManage: boolean;
}) {
  const { data: members, isPending } = useMembers();
  const { data: assignees } = useTaskAssignees();
  const toggle = useToggleAssignee();
  const [query, setQuery] = useState('');
  const list = members ?? [];
  const assigned = new Set(assignees?.get(task.id));
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? list.filter((m) => m.name.toLocaleLowerCase().includes(q)) : list;

  return (
    <div className="flex flex-col">
      {list.length > FILTER_THRESHOLD && (
        <div className="p-1 pb-0">
          <Input
            aria-label="Filter members"
            placeholder="Filter members…"
            autoFocus={!focusManage}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <div className="p-1">
        {isPending ? (
          <p className="px-2 py-1.5 text-subtle">Loading…</p>
        ) : list.length === 0 ? (
          <p className="px-2 py-1.5 text-subtle">No team members yet</p>
        ) : shown.length === 0 ? (
          <p className="px-2 py-1.5 text-subtle">No matching members</p>
        ) : (
          <ul aria-label="Team members">
            {shown.map((member) => {
              const checked = assigned.has(member.id);
              return (
                <li key={member.id}>
                  <label className={cn(rowClass, 'cursor-pointer')}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isTempId(member.id)}
                      onChange={() => toggle(task.id, member.id, !checked)}
                      className="size-3.5 shrink-0 cursor-pointer accent-accent focus-visible:outline-offset-1"
                    />
                    <Avatar member={member} size={20} />
                    <span className="truncate">{member.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-border p-1">
        <button type="button" autoFocus={focusManage} onClick={onManage} className={linkClass}>
          <Settings2 aria-hidden className="size-4 text-subtle" />
          Manage team…
        </button>
      </div>
    </div>
  );
}

/**
 * Value cell of the sheet's "Assignees" row: avatars + names (or "No assignees"), opening a
 * checkbox picker. Toggles apply instantly (optimistic). Disabled while the task is unsaved.
 *
 * "Manage team…" swaps the popover to the same management UI as the header. (The header's own
 * popover can't be used from here: the sheet is a modal dialog.)
 */
export function AssigneeField({ task }: { task: Task }) {
  const assigned = useTaskMembers(task.id);
  const [open, setOpen] = useState(false);
  /** `back` = the picker, returning from "manage" (focus goes to "Manage team…"). */
  const [view, setView] = useState<'pick' | 'manage' | 'back'>('pick');
  const disabled = isTempId(task.id);
  const names = assigned.map((m) => m.name).join(', ');

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView('pick');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(triggerClass, assigned.length > 0 ? 'gap-1.5' : 'gap-1')}
        >
          {assigned.length > 0 ? (
            <>
              <AvatarStack members={assigned} size={20} srPrefix={null} />
              <span className="truncate">
                <span className="sr-only">Assignees:</span> {names}
              </span>
            </>
          ) : (
            <>
              <UserRound aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="truncate text-subtle">
                <span className="sr-only">Assignees:</span> No assignees
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={view === 'manage' ? 'Manage team' : 'Assign members'}
        className="w-[min(18rem,calc(100vw-1rem))] p-0"
      >
        {view === 'manage' ? (
          <div className="flex flex-col">
            <div className="border-b border-border p-1">
              <button type="button" autoFocus onClick={() => setView('back')} className={linkClass}>
                <ChevronLeft aria-hidden className="size-4 text-subtle" />
                Back to assignees
              </button>
            </div>
            <TeamManager />
          </div>
        ) : (
          <Picker task={task} focusManage={view === 'back'} onManage={() => setView('manage')} />
        )}
      </PopoverContent>
    </Popover>
  );
}
