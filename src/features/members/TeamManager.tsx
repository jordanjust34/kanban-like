import { Pencil, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { isTempId } from '@/features/tasks/taskList';
import {
  useAssignedTaskCounts,
  useCreateMember,
  useDeleteMember,
  useMembers,
  useUpdateMember,
} from './api';
import { Avatar } from './Avatar';
import { MemberForm } from './MemberForm';
import { firstName, nextFreeColor, type Member, type MemberInput } from './model';

type Mode = { kind: 'edit' | 'delete'; id: string } | null;

function changedFields(member: Member, next: MemberInput): Partial<MemberInput> {
  const patch: Partial<MemberInput> = {};
  if (next.name !== member.name) patch.name = next.name;
  if (next.color.toLowerCase() !== member.color.toLowerCase()) patch.color = next.color;
  if (next.avatar_url !== member.avatar_url) patch.avatar_url = next.avatar_url;
  return patch;
}

function deletePrompt(member: Member, taskCount: number): string {
  const who = firstName(member.name);
  if (taskCount === 0) return `Remove ${who}?`;
  return `Remove ${who}? They'll be unassigned from ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}.`;
}

/**
 * Team management (list, add, inline edit, inline delete confirmation). Rendered inside the
 * header's popover and inside the assignee picker's "Manage team…" view.
 */
export function TeamManager() {
  const headingId = useId();
  const { data: members, isPending, isError } = useMembers();
  const counts = useAssignedTaskCounts();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const [mode, setMode] = useState<Mode>(null);
  /** Member whose Edit button gets focus when its row re-renders (after edit / cancel). */
  const [focusId, setFocusId] = useState<string | null>(null);
  const addNameRef = useRef<HTMLInputElement>(null);
  const list = members ?? [];

  const closeRow = (id: string) => {
    setMode(null);
    setFocusId(id);
  };

  return (
    <div className="flex flex-col">
      <h2 id={headingId} className="px-3 pt-2.5 pb-1 text-meta text-subtle">
        Team members
      </h2>

      {isPending ? (
        <div className="flex justify-center py-3 text-subtle">
          <Spinner size={14} label="Loading team" />
        </div>
      ) : isError ? (
        <p className="px-3 py-2 text-subtle">Couldn't load the team.</p>
      ) : list.length === 0 ? (
        <p className="px-3 py-2 text-subtle">No team members yet</p>
      ) : (
        <ul aria-labelledby={headingId} className="px-1">
          {list.map((member) => {
            const saving = isTempId(member.id);
            if (mode?.id === member.id && mode.kind === 'edit') {
              return (
                <li key={member.id} className="my-1 rounded-sm border border-border p-2">
                  <MemberForm
                    initial={member}
                    defaultColor={member.color}
                    submitLabel="Save"
                    autoFocus
                    onCancel={() => closeRow(member.id)}
                    onSubmit={(value) => {
                      const patch = changedFields(member, value);
                      if (Object.keys(patch).length > 0) updateMember(member.id, patch);
                      closeRow(member.id);
                    }}
                  />
                </li>
              );
            }
            if (mode?.id === member.id && mode.kind === 'delete') {
              const promptId = `${headingId}-delete-${member.id}`;
              return (
                <li key={member.id}>
                  <div
                    role="group"
                    aria-labelledby={promptId}
                    className="my-1 rounded-sm bg-danger-soft p-2"
                  >
                    <p id={promptId} className="mb-2 text-primary">
                      {deletePrompt(member, counts.get(member.id) ?? 0)}
                    </p>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        autoFocus
                        onClick={() => closeRow(member.id)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          addNameRef.current?.focus();
                          setMode(null);
                          deleteMember(member.id);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              );
            }
            return (
              <li
                key={member.id}
                className="flex h-9 items-center gap-2 rounded-sm pr-1 pl-2 hover:bg-hover"
              >
                <Avatar member={member} size={24} />
                <span className="min-w-0 flex-1 truncate">{member.name}</span>
                {saving && <Spinner size={12} label="Saving" />}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil />}
                  aria-label={`Edit ${member.name}`}
                  disabled={saving}
                  autoFocus={focusId === member.id}
                  onClick={() => setMode({ kind: 'edit', id: member.id })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  aria-label={`Remove ${member.name}`}
                  disabled={saving}
                  onClick={() => setMode({ kind: 'delete', id: member.id })}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1 border-t border-border px-3 pt-2.5 pb-3">
        <h3 className="mb-2 text-[13px] leading-5 font-medium text-primary">Add member</h3>
        <MemberForm
          nameRef={addNameRef}
          defaultColor={nextFreeColor(list)}
          submitLabel="Add"
          onSubmit={(value) => {
            createMember(value);
            addNameRef.current?.focus();
          }}
        />
      </div>
    </div>
  );
}
