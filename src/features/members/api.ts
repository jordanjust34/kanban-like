/**
 * Team members and task assignees data access (DESIGN §5.2). The only module that talks to
 * `team_members` / `task_assignees`; components use these hooks.
 *
 * Same optimistic pattern as `features/tasks/api.ts`: apply to the cache synchronously → send →
 * on error restore just the touched rows + toast → refetch once the last write has settled.
 *
 * Cache keys are per user (`[...queryKeys.members, userId]`, `[...queryKeys.taskAssignees,
 * userId]`), and another user's entries are dropped as soon as the user changes.
 */
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/app/auth';
import { useTasks } from '@/features/tasks/api';
import { showErrorToast } from '@/features/tasks/errors';
import { isTempId, makeTempId } from '@/features/tasks/taskList';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import {
  applyToggle,
  groupAssignees,
  isForeignKeyError,
  isUniqueViolation,
  patchMember,
  removeMember,
  removeMemberLinks,
  replaceMember,
  upsertMember,
  type AssigneeLink,
  type Member,
  type MemberInput,
} from './model';

/** Shared by every member / assignee write, so only the last one to settle refetches. */
const MEMBERS_WRITE_KEY = ['members', 'write'] as const;

export const FK_ERROR_TITLE = "Couldn't assign — task or member no longer exists";

export function membersQueryKey(userId: string | null) {
  return [...queryKeys.members, userId] as const;
}

export function taskAssigneesQueryKey(userId: string | null) {
  return [...queryKeys.taskAssignees, userId] as const;
}

/* ──────────────────────────────── queries ──────────────────────────────── */

/** Current user id once the session is ready; drops other users' entries under `prefix`. */
function useScopedUser(prefix: readonly string[]): string | null {
  const session = useSession();
  const queryClient = useQueryClient();
  // `user?.`: tolerate a partial session object (some shell tests stub `{}` as the session).
  const userId = session.status === 'ready' ? (session.session.user?.id ?? null) : null;

  useEffect(() => {
    if (!userId) return;
    queryClient.removeQueries({
      queryKey: prefix,
      predicate: (query) => query.queryKey[1] !== userId,
    });
  }, [queryClient, userId, prefix]);

  return userId;
}

async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

async function fetchAssignees(): Promise<AssigneeLink[]> {
  const { data, error } = await supabase.from('task_assignees').select('task_id, member_id');
  if (error) throw error;
  return data;
}

/** The signed-in guest's team, ordered by `created_at`. */
export function useMembers() {
  const userId = useScopedUser(queryKeys.members);
  return useQuery({
    queryKey: membersQueryKey(userId),
    queryFn: fetchMembers,
    enabled: userId !== null,
  });
}

/** All of the guest's assignee links as `Map<taskId, memberId[]>` (memoized per fetch). */
export function useTaskAssignees() {
  const userId = useScopedUser(queryKeys.taskAssignees);
  return useQuery({
    queryKey: taskAssigneesQueryKey(userId),
    queryFn: fetchAssignees,
    enabled: userId !== null,
    select: groupAssignees,
  });
}

/** `Map<memberId, number of existing tasks they're assigned to>` (for the delete prompt). */
export function useAssignedTaskCounts(): Map<string, number> {
  const { data: tasks } = useTasks();
  const { data: assignees } = useTaskAssignees();
  return useMemo(() => {
    const counts = new Map<string, number>();
    if (!tasks || !assignees) return counts;
    for (const task of tasks) {
      for (const memberId of assignees.get(task.id) ?? []) {
        counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
      }
    }
    return counts;
  }, [tasks, assignees]);
}

/* ───────────────────────────── cache plumbing ───────────────────────────── */

type Cache<T> = {
  get(): T[];
  update(fn: (rows: T[]) => T[]): void;
};

function sessionUserId(queryClient: QueryClient): string | null {
  return queryClient.getQueryData<Session>(queryKeys.session)?.user.id ?? null;
}

function makeCache<T>(
  queryClient: QueryClient,
  keyFor: (userId: string | null) => readonly unknown[],
): Cache<T> {
  return {
    get: () => queryClient.getQueryData<T[]>(keyFor(sessionUserId(queryClient))) ?? [],
    update: (fn) => {
      const key = keyFor(sessionUserId(queryClient));
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<T[]>(key, (old) => (old ? fn(old) : old));
    },
  };
}

function useCaches() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      members: makeCache<Member>(queryClient, membersQueryKey),
      links: makeCache<AssigneeLink>(queryClient, taskAssigneesQueryKey),
      /** Refetch both, unless another member write is still in flight. */
      settle: () => {
        if (queryClient.isMutating({ mutationKey: MEMBERS_WRITE_KEY }) <= 1) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.members });
          void queryClient.invalidateQueries({ queryKey: queryKeys.taskAssignees });
        }
      },
    }),
    [queryClient],
  );
}

function assertFound(data: unknown[] | null): void {
  if (!data || data.length === 0) throw new Error('This member no longer exists.');
}

/* ──────────────────────────────── members ──────────────────────────────── */

type CreateVars = { input: MemberInput; tempId: string };

/** Returns `createMember(input)`; the row shows at once with a temp id. `user_id` is a DB default. */
export function useCreateMember() {
  const caches = useCaches();
  const { mutate } = useMutation({
    mutationKey: MEMBERS_WRITE_KEY,
    networkMode: 'always',
    mutationFn: async ({ input }: CreateVars) => {
      const { data, error } = await supabase.from('team_members').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (member, { tempId }) =>
      caches.members.update((list) => replaceMember(list, tempId, member)),
    onError: (error, { input, tempId }) => {
      caches.members.update((list) => removeMember(list, tempId));
      showErrorToast("Couldn't add member", error, () => create(input));
    },
    onSettled: () => caches.settle(),
  });

  const create = useCallback(
    (input: MemberInput): string => {
      const tempId = makeTempId();
      const optimistic: Member = {
        ...input,
        id: tempId,
        user_id: '',
        created_at: new Date().toISOString(),
      };
      caches.members.update((list) => upsertMember(list, optimistic));
      mutate({ input, tempId });
      return tempId;
    },
    [caches, mutate],
  );
  return create;
}

type UpdateVars = { id: string; patch: Partial<MemberInput>; previous: Member };

/** Returns `updateMember(id, patch)`. Returns false for unknown or unsaved (temp) members. */
export function useUpdateMember() {
  const caches = useCaches();
  const { mutate } = useMutation({
    mutationKey: MEMBERS_WRITE_KEY,
    networkMode: 'always',
    mutationFn: async ({ id, patch }: UpdateVars) => {
      const { data, error } = await supabase
        .from('team_members')
        .update(patch)
        .eq('id', id)
        .select('id');
      if (error) throw error;
      assertFound(data);
    },
    onError: (error, { id, patch, previous }) => {
      caches.members.update((list) => upsertMember(list, previous));
      showErrorToast("Couldn't save member", error, () => update(id, patch));
    },
    onSettled: () => caches.settle(),
  });

  const update = useCallback(
    (id: string, patch: Partial<MemberInput>): boolean => {
      const previous = caches.members.get().find((m) => m.id === id);
      if (!previous || isTempId(id)) return false;
      caches.members.update((list) => patchMember(list, id, patch));
      mutate({ id, patch, previous });
      return true;
    },
    [caches, mutate],
  );
  return update;
}

type DeleteVars = { member: Member; links: AssigneeLink[] };

/** Returns `deleteMember(id)`. Also drops its links from the cache (the DB cascades). No undo. */
export function useDeleteMember() {
  const caches = useCaches();
  const { mutate } = useMutation({
    mutationKey: MEMBERS_WRITE_KEY,
    networkMode: 'always',
    mutationFn: async ({ member }: DeleteVars) => {
      const { error } = await supabase.from('team_members').delete().eq('id', member.id);
      if (error) throw error;
    },
    onError: (error, { member, links }) => {
      caches.members.update((list) => upsertMember(list, member));
      caches.links.update((list) => [...removeMemberLinks(list, member.id), ...links]);
      showErrorToast("Couldn't remove member", error, () => remove(member.id));
    },
    onSettled: () => caches.settle(),
  });

  const remove = useCallback(
    (id: string): boolean => {
      const member = caches.members.get().find((m) => m.id === id);
      if (!member || isTempId(id)) return false;
      const links = caches.links.get().filter((l) => l.member_id === id);
      caches.members.update((list) => removeMember(list, id));
      caches.links.update((list) => removeMemberLinks(list, id));
      mutate({ member, links });
      return true;
    },
    [caches, mutate],
  );
  return remove;
}

/* ─────────────────────────────── assignees ─────────────────────────────── */

type ToggleVars = { taskId: string; memberId: string; assigned: boolean };

/**
 * Returns `toggleAssignee(taskId, memberId, assigned)`. Writes run one at a time (shared
 * mutation scope), so a quick check / uncheck can't reach the server out of order.
 */
export function useToggleAssignee() {
  const caches = useCaches();
  const { mutate } = useMutation({
    mutationKey: MEMBERS_WRITE_KEY,
    scope: { id: 'task-assignees' },
    networkMode: 'always',
    mutationFn: async ({ taskId, memberId, assigned }: ToggleVars) => {
      if (assigned) {
        const { error } = await supabase
          .from('task_assignees')
          .insert({ task_id: taskId, member_id: memberId });
        if (error && !isUniqueViolation(error)) throw error;
      } else {
        const { error } = await supabase
          .from('task_assignees')
          .delete()
          .eq('task_id', taskId)
          .eq('member_id', memberId);
        if (error) throw error;
      }
    },
    onError: (error, { taskId, memberId, assigned }) => {
      caches.links.update((list) => applyToggle(list, taskId, memberId, !assigned));
      if (isForeignKeyError(error)) toast.error(FK_ERROR_TITLE);
      else
        showErrorToast(assigned ? "Couldn't assign" : "Couldn't unassign", error, () =>
          toggle(taskId, memberId, assigned),
        );
    },
    onSettled: () => caches.settle(),
  });

  const toggle = useCallback(
    (taskId: string, memberId: string, assigned: boolean): boolean => {
      if (isTempId(taskId) || isTempId(memberId)) return false;
      caches.links.update((list) => applyToggle(list, taskId, memberId, assigned));
      mutate({ taskId, memberId, assigned });
      return true;
    },
    [caches, mutate],
  );
  return toggle;
}
