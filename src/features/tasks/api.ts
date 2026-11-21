/**
 * Task data access (DESIGN §5.2). The only module that talks to the `tasks` table; components
 * use these hooks and never call `supabase` directly.
 *
 * Optimistic pattern used by every write:
 *   cancel task queries → snapshot the touched rows → apply to the cache (synchronously, so a
 *   drop never flickers back for a frame) → send → on error restore the snapshot + toast with
 *   Retry → invalidate once the last task write has settled.
 *
 * Cache key: `[...queryKeys.tasks, userId]`. Keying on the user means a sign-out or a new guest
 * can never be shown the previous user's cached board; `invalidateQueries({ queryKey:
 * queryKeys.tasks })` still matches by prefix.
 */
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/app/auth';
import type { Tables } from '@/lib/database.types';
import { DEFAULT_PRIORITY, isPriority, isStatus, type Status } from '@/lib/domain';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { showErrorToast } from './errors';
import {
  claimAllPendingDeletes,
  claimPendingDelete,
  finishPendingDelete,
  markPendingDelete,
  undoPendingDelete,
  withoutPendingDeletes,
} from './pendingDeletes';
import {
  applyPatches,
  isTempId,
  makeTempId,
  patchTask,
  planMove,
  removeTask,
  replaceTask,
  restoreTasks,
  topPosition,
  upsertTask,
  type MoveInput,
  type TaskPatch,
} from './taskList';
import type { Task, TaskInsert, TaskUpdate } from './types';

/**
 * Shared by every task write, so only the last one to settle triggers a refetch.
 * Writes use `networkMode: 'always'`: offline they fail fast and roll back with a toast
 * (FR-B4 / FR-S3) instead of silently pausing until the connection returns.
 */
const TASK_WRITE_KEY = ['tasks', 'write'] as const;

/** How long the "Task deleted" toast offers Undo before the DELETE is sent (D12). */
export const UNDO_DELETE_MS = 5000;

export function tasksQueryKey(userId: string | null) {
  return [...queryKeys.tasks, userId] as const;
}

/** Narrows a DB row's `status` / `priority` strings to their unions. */
function toTask(row: Tables<'tasks'>): Task {
  return {
    ...row,
    status: isStatus(row.status) ? row.status : 'todo',
    priority: isPriority(row.priority) ? row.priority : DEFAULT_PRIORITY,
  };
}

async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(toTask);
}

/** Latest access token, for the keepalive DELETE sent on `pagehide` (can't await there). */
let latestAccessToken: string | null = null;

/** All of the signed-in guest's tasks, ordered by position, minus pending deletes. */
export function useTasks() {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.status === 'ready' ? session.session.user.id : null;
  const accessToken = session.status === 'ready' ? session.session.access_token : null;

  useEffect(() => {
    if (accessToken) latestAccessToken = accessToken;
  }, [accessToken]);

  // Another guest's board must never linger in the cache once the user changes.
  useEffect(() => {
    if (!userId) return;
    queryClient.removeQueries({
      queryKey: queryKeys.tasks,
      predicate: (query) => query.queryKey[1] !== userId,
    });
  }, [queryClient, userId]);

  return useQuery({
    queryKey: tasksQueryKey(userId),
    queryFn: fetchTasks,
    enabled: userId !== null,
    select: withoutPendingDeletes,
  });
}

/* ───────────────────────────── cache plumbing ───────────────────────────── */

type TaskCache = {
  queryClient: QueryClient;
  /** Current (unfiltered) cached list. */
  get(): Task[];
  /** Cancels in-flight fetches and applies `fn` to the cache synchronously. */
  update(fn: (tasks: Task[]) => Task[]): void;
  /** Refetch, unless another task write is still in flight (it will refetch when it settles). */
  settle(): void;
};

function currentKey(queryClient: QueryClient) {
  const session = queryClient.getQueryData<Session>(queryKeys.session);
  return tasksQueryKey(session?.user.id ?? null);
}

function useTaskCache(): TaskCache {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      queryClient,
      get: () => queryClient.getQueryData<Task[]>(currentKey(queryClient)) ?? [],
      update: (fn) => {
        const key = currentKey(queryClient);
        void queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<Task[]>(key, (old) => (old ? fn(old) : old));
      },
      settle: () => {
        if (queryClient.isMutating({ mutationKey: TASK_WRITE_KEY }) <= 1) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
        }
      },
    }),
    [queryClient],
  );
}

/** Throws when PostgREST matched no row (deleted elsewhere, or not ours under RLS). */
function assertFound(data: unknown[] | null): void {
  if (!data || data.length === 0) throw new Error('This task no longer exists.');
}

/* ───────────────────────────────── create ───────────────────────────────── */

export type CreateTaskInput = Omit<TaskInsert, 'position' | 'id'> & { status: Status };

type CreateVars = { input: CreateTaskInput; tempId: string; position: number };

/**
 * Returns `createTask(input)`. The card appears at the top of its column at once (temp id) and
 * is swapped for the real row when the insert returns. `user_id` is set by the DB default.
 */
export function useCreateTask() {
  const cache = useTaskCache();
  const { mutate } = useMutation({
    mutationKey: TASK_WRITE_KEY,
    networkMode: 'always',
    mutationFn: async ({ input, position }: CreateVars) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...input, position })
        .select()
        .single();
      if (error) throw error;
      return toTask(data);
    },
    onSuccess: (task, { tempId }) => cache.update((list) => replaceTask(list, tempId, task)),
    onError: (error, { input, tempId }) => {
      cache.update((list) => removeTask(list, tempId));
      showErrorToast("Couldn't create task", error, () => create(input));
    },
    onSettled: () => cache.settle(),
  });

  const create = useCallback(
    (input: CreateTaskInput): string => {
      const tempId = makeTempId();
      const position = topPosition(cache.get(), input.status);
      const now = new Date().toISOString();
      const optimistic: Task = {
        id: tempId,
        user_id: '',
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority ?? DEFAULT_PRIORITY,
        due_date: input.due_date ?? null,
        position,
        created_at: now,
        updated_at: now,
      };
      cache.update((list) => upsertTask(list, optimistic));
      mutate({ input, tempId, position });
      return tempId;
    },
    [cache, mutate],
  );
  return create;
}

/* ───────────────────────────────── update ───────────────────────────────── */

type UpdateVars = { id: string; patch: TaskUpdate; previous: Task };

/** Returns `updateTask(id, patch)` for field edits (title, description, priority, due date…). */
export function useUpdateTask() {
  const cache = useTaskCache();
  const { mutate } = useMutation({
    mutationKey: TASK_WRITE_KEY,
    networkMode: 'always',
    mutationFn: async ({ id, patch }: UpdateVars) => {
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select('id');
      if (error) throw error;
      assertFound(data);
    },
    onError: (error, { id, patch, previous }) => {
      cache.update((list) => restoreTasks(list, [previous]));
      showErrorToast("Couldn't save changes", error, () => update(id, patch));
    },
    onSettled: () => cache.settle(),
  });

  const update = useCallback(
    (id: string, patch: TaskUpdate): boolean => {
      const previous = cache.get().find((t) => t.id === id);
      if (!previous || isTempId(id)) return false;
      cache.update((list) => patchTask(list, id, patch));
      mutate({ id, patch, previous });
      return true;
    },
    [cache, mutate],
  );
  return update;
}

/* ────────────────────────────────── move ────────────────────────────────── */

type MoveVars = { input: MoveInput; patches: TaskPatch[]; previous: Task[] };

/**
 * Returns `moveTask({ id, status, afterId, beforeId })`. Sends only `{ status, position }` for
 * the moved row; if the column's gaps are exhausted it also renumbers that column
 * (`update` per row: an `upsert` of partial rows would fail the NOT NULL insert path).
 * Returns false when the card is already there (no request is made).
 */
export function useMoveTask() {
  const cache = useTaskCache();
  const { mutate } = useMutation({
    mutationKey: TASK_WRITE_KEY,
    networkMode: 'always',
    mutationFn: async ({ patches }: MoveVars) => {
      const results = await Promise.all(
        patches.map(({ id, status, position }) =>
          supabase
            .from('tasks')
            .update(status ? { status, position } : { position })
            .eq('id', id)
            .select('id'),
        ),
      );
      for (const { data, error } of results) {
        if (error) throw error;
        assertFound(data);
      }
    },
    onError: (error, { input, previous }) => {
      cache.update((list) => restoreTasks(list, previous));
      showErrorToast("Couldn't move task", error, () => move(input));
    },
    onSettled: () => cache.settle(),
  });

  const move = useCallback(
    (input: MoveInput): boolean => {
      if (isTempId(input.id)) return false;
      const tasks = cache.get();
      const patches = planMove(tasks, input);
      if (!patches) return false;
      const touched = new Set(patches.map((p) => p.id));
      const previous = tasks.filter((t) => touched.has(t.id));
      cache.update((list) => applyPatches(list, patches));
      mutate({ input, patches, previous });
      return true;
    },
    [cache, mutate],
  );
  return move;
}

/* ───────────────────────────────── delete ───────────────────────────────── */

async function sendDelete(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Fire-and-forget DELETE that survives page unload. supabase-js can't be used here: it awaits
 * the session before fetching, and a plain fetch is cancelled when the page goes away.
 */
function sendDeletesOnUnload(ids: string[]): void {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !latestAccessToken || ids.length === 0) return;
  void fetch(`${url}/rest/v1/tasks?id=in.(${ids.map(encodeURIComponent).join(',')})`, {
    method: 'DELETE',
    keepalive: true,
    headers: { apikey: key, Authorization: `Bearer ${latestAccessToken}` },
  }).catch(() => {});
}

let unloadListenerInstalled = false;

function installUnloadFlush(): void {
  if (unloadListenerInstalled || typeof window === 'undefined') return;
  unloadListenerInstalled = true;
  window.addEventListener('pagehide', () => {
    const tasks = claimAllPendingDeletes();
    sendDeletesOnUnload(tasks.map((t) => t.id));
    for (const task of tasks) {
      finishPendingDelete(task.id);
      toast.dismiss(deleteToastId(task.id));
    }
  });
}

const deleteToastId = (id: string) => `delete-${id}`;

/**
 * Returns `deleteTask(task)` (D12): the card disappears at once and a 5 s "Task deleted" toast
 * offers Undo. The DELETE is sent when the toast closes without Undo; if it fails, the card
 * comes back and an error toast offers Retry.
 */
export function useDeleteTask() {
  const cache = useTaskCache();

  return useMemo(() => {
    const commit = (id: string) => {
      const task = claimPendingDelete(id);
      if (!task) return;
      sendDelete(id).then(
        () => {
          finishPendingDelete(id);
          cache.settle();
        },
        (error: unknown) => {
          finishPendingDelete(id);
          cache.update((list) => upsertTask(list, task));
          showErrorToast("Couldn't delete task", error, () => remove(task));
        },
      );
    };

    const undo = (id: string) => {
      const task = undoPendingDelete(id);
      if (task) cache.update((list) => upsertTask(list, task));
    };

    function remove(task: Task): void {
      if (isTempId(task.id)) return;
      installUnloadFlush();
      markPendingDelete(task);
      cache.update((list) => removeTask(list, task.id));
      toast('Task deleted', {
        id: deleteToastId(task.id),
        description: task.title,
        duration: UNDO_DELETE_MS,
        action: { label: 'Undo', onClick: () => undo(task.id) },
        onAutoClose: () => commit(task.id),
        onDismiss: () => commit(task.id),
      });
    }

    return remove;
  }, [cache]);
}
