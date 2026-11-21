/**
 * Label data access (DESIGN §3, §5.2). The only module that talks to `labels` / `task_labels`.
 *
 * Same optimistic pattern as `features/tasks/api.ts`: cancel → apply to the cache synchronously
 * → send → on error restore just the touched rows + toast with Retry → invalidate once the last
 * label write has settled. Every label write shares one mutation scope, so they reach the server
 * in the order they were made (a quick attach → detach can't arrive reversed).
 *
 * Cache keys: `[...queryKeys.labels, userId]` and `[...queryKeys.taskLabels, userId]`. `user_id`
 * is never sent: the DB default (`auth.uid()`) fills it and the composite FKs check ownership.
 */
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSession } from '@/app/auth';
import { showErrorToast } from '@/features/tasks/errors';
import { isTempId, makeTempId } from '@/features/tasks/taskList';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import {
  addLink,
  duplicateNameMessage,
  hasLink,
  isUniqueViolation,
  labelsForTask,
  linksForLabel,
  patchLabel,
  relinkLabel,
  removeLabel,
  removeLink,
  removeLinksForLabel,
  replaceLabel,
  sortLabels,
  toTaskLabelMap,
  upsertLabel,
  type Label,
  type TaskLabelLink,
} from './labelList';

export type { Label, TaskLabelLink, TaskLabelMap } from './labelList';

const LABEL_WRITE_KEY = ['labels', 'write'] as const;
const LABEL_WRITE_SCOPE = { id: 'label-writes' };

export function labelsQueryKey(userId: string | null) {
  return [...queryKeys.labels, userId] as const;
}

export function taskLabelsQueryKey(userId: string | null) {
  return [...queryKeys.taskLabels, userId] as const;
}

/** Signed-in user id once the session is ready; also drops another user's cached labels. */
function useUserId(): string | null {
  const session = useSession();
  const queryClient = useQueryClient();
  // `?.`: tolerate a partial session object (tests stub `{}`); no user means not ready.
  const userId = session.status === 'ready' ? (session.session.user?.id ?? null) : null;

  useEffect(() => {
    if (!userId) return;
    for (const prefix of [queryKeys.labels, queryKeys.taskLabels]) {
      queryClient.removeQueries({
        queryKey: prefix,
        predicate: (query) => query.queryKey[1] !== userId,
      });
    }
  }, [queryClient, userId]);

  return userId;
}

async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase.from('labels').select('*').order('name');
  if (error) throw error;
  return sortLabels(data);
}

async function fetchTaskLabels(): Promise<TaskLabelLink[]> {
  const { data, error } = await supabase.from('task_labels').select('task_id, label_id');
  if (error) throw error;
  return data;
}

/** The user's labels, by name. */
export function useLabels() {
  const userId = useUserId();
  return useQuery({
    queryKey: labelsQueryKey(userId),
    queryFn: fetchLabels,
    enabled: userId !== null,
  });
}

/** All of the user's task↔label links in one query, as `Map<taskId, labelId[]>`. */
export function useTaskLabels() {
  const userId = useUserId();
  return useQuery({
    queryKey: taskLabelsQueryKey(userId),
    queryFn: fetchTaskLabels,
    enabled: userId !== null,
    // Module-level function: TanStack only re-runs it when the links change.
    select: toTaskLabelMap,
  });
}

/** Raw links (for counts in the picker). */
export function useTaskLabelLinks() {
  const userId = useUserId();
  return useQuery({
    queryKey: taskLabelsQueryKey(userId),
    queryFn: fetchTaskLabels,
    enabled: userId !== null,
  });
}

const NO_LABELS: Label[] = [];

/** One task's labels, in display order. */
export function useLabelsForTask(taskId: string): Label[] {
  const { data: labels } = useLabels();
  const { data: map } = useTaskLabels();
  return useMemo(
    () => (labels && map ? labelsForTask(labels, map, taskId) : NO_LABELS),
    [labels, map, taskId],
  );
}

/* ───────────────────────────── cache plumbing ───────────────────────────── */

type LabelCache = {
  labels(): Label[];
  links(): TaskLabelLink[];
  updateLabels(fn: (labels: Label[]) => Label[]): void;
  updateLinks(fn: (links: TaskLabelLink[]) => TaskLabelLink[]): void;
  /** Refetch both lists, unless another label write is still in flight. */
  settle(): void;
};

function currentUserId(queryClient: QueryClient): string | null {
  return queryClient.getQueryData<Session>(queryKeys.session)?.user.id ?? null;
}

function useLabelCache(): LabelCache {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const labelsKey = () => labelsQueryKey(currentUserId(queryClient));
    const linksKey = () => taskLabelsQueryKey(currentUserId(queryClient));
    return {
      labels: () => queryClient.getQueryData<Label[]>(labelsKey()) ?? [],
      links: () => queryClient.getQueryData<TaskLabelLink[]>(linksKey()) ?? [],
      updateLabels: (fn) => {
        const key = labelsKey();
        void queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<Label[]>(key, (old) => (old ? fn(old) : old));
      },
      updateLinks: (fn) => {
        const key = linksKey();
        void queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<TaskLabelLink[]>(key, (old) => (old ? fn(old) : old));
      },
      settle: () => {
        if (queryClient.isMutating({ mutationKey: LABEL_WRITE_KEY }) <= 1) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.labels });
          void queryClient.invalidateQueries({ queryKey: queryKeys.taskLabels });
        }
      },
    };
  }, [queryClient]);
}

function assertFound(data: unknown[] | null): void {
  if (!data || data.length === 0) throw new Error('This label no longer exists.');
}

/**
 * Outcome of a create / rename. `error` is a message to show inline (a duplicate name); it is
 * `null` when the failure was already reported with a toast.
 */
export type LabelWriteResult = { ok: true } | { ok: false; error: string | null };

const DONE: LabelWriteResult = { ok: true };
const TOASTED: LabelWriteResult = { ok: false, error: null };

/* ───────────────────────────────── create ───────────────────────────────── */

export type CreateLabelInput = { name: string; color: string };

type CreateVars = CreateLabelInput & { tempId: string; attachTo: string | null };

/** The label was saved but attaching it to the task failed. */
class AttachError extends Error {
  readonly label: Label;
  readonly reason: unknown;
  constructor(label: Label, reason: unknown) {
    super('Attach failed');
    this.label = label;
    this.reason = reason;
  }
}

/**
 * Returns `createLabel(input, attachTo?)`. The label (and, with `attachTo`, its link to that
 * task) appears at once under a temp id; the name must already be validated by the caller.
 */
export function useCreateLabel() {
  const cache = useLabelCache();
  const { mutateAsync } = useMutation({
    mutationKey: LABEL_WRITE_KEY,
    scope: LABEL_WRITE_SCOPE,
    networkMode: 'always',
    mutationFn: async ({ name, color, attachTo }: CreateVars) => {
      const { data: label, error } = await supabase
        .from('labels')
        .insert({ name, color })
        .select()
        .single();
      if (error) throw error;
      if (attachTo) {
        const link = await supabase
          .from('task_labels')
          .insert({ task_id: attachTo, label_id: label.id });
        if (link.error) throw new AttachError(label, link.error);
      }
      return label;
    },
    onSuccess: (label, { tempId }) => {
      cache.updateLabels((list) => replaceLabel(list, tempId, label));
      cache.updateLinks((links) => relinkLabel(links, tempId, label.id));
    },
    onError: (error, { tempId, name, color, attachTo }) => {
      if (error instanceof AttachError) {
        const { label } = error;
        cache.updateLabels((list) => replaceLabel(list, tempId, label));
        cache.updateLinks((links) => removeLinksForLabel(links, tempId));
        return;
      }
      cache.updateLabels((list) => removeLabel(list, tempId));
      cache.updateLinks((links) => removeLinksForLabel(links, tempId));
      if (!isUniqueViolation(error)) {
        showErrorToast(
          "Couldn't create label",
          error,
          () => void create({ name, color }, attachTo),
        );
      }
    },
    onSettled: () => cache.settle(),
  });

  const toggle = useToggleTaskLabel();

  const create = useCallback(
    async (input: CreateLabelInput, attachTo: string | null = null): Promise<LabelWriteResult> => {
      const tempId = makeTempId();
      const target = attachTo && !isTempId(attachTo) ? attachTo : null;
      cache.updateLabels((list) =>
        upsertLabel(list, {
          id: tempId,
          user_id: '',
          name: input.name,
          color: input.color,
          created_at: new Date().toISOString(),
        }),
      );
      if (target) cache.updateLinks((links) => addLink(links, target, tempId));
      try {
        await mutateAsync({ ...input, tempId, attachTo: target });
        return DONE;
      } catch (error) {
        if (error instanceof AttachError) {
          showErrorToast("Couldn't add label to task", error.reason, () =>
            toggle(target ?? '', error.label.id, true),
          );
          return TOASTED;
        }
        return isUniqueViolation(error)
          ? { ok: false, error: duplicateNameMessage(input.name) }
          : TOASTED;
      }
    },
    [cache, mutateAsync, toggle],
  );
  return create;
}

/* ───────────────────────────────── update ───────────────────────────────── */

export type LabelPatch = Partial<Pick<Label, 'name' | 'color'>>;

type UpdateVars = { id: string; patch: LabelPatch; previous: Label };

/** Returns `updateLabel(id, patch)` for rename / recolor. A duplicate name comes back inline. */
export function useUpdateLabel() {
  const cache = useLabelCache();
  const { mutateAsync } = useMutation({
    mutationKey: LABEL_WRITE_KEY,
    scope: LABEL_WRITE_SCOPE,
    networkMode: 'always',
    mutationFn: async ({ id, patch }: UpdateVars) => {
      const { data, error } = await supabase.from('labels').update(patch).eq('id', id).select('id');
      if (error) throw error;
      assertFound(data);
    },
    onError: (error, { id, patch, previous }) => {
      cache.updateLabels((list) =>
        list.some((l) => l.id === id) ? upsertLabel(list, previous) : list,
      );
      if (!isUniqueViolation(error)) {
        showErrorToast("Couldn't save label", error, () => void update(id, patch));
      }
    },
    onSettled: () => cache.settle(),
  });

  const update = useCallback(
    async (id: string, patch: LabelPatch): Promise<LabelWriteResult> => {
      const previous = cache.labels().find((l) => l.id === id);
      if (!previous || isTempId(id)) return TOASTED;
      cache.updateLabels((list) => patchLabel(list, id, patch));
      try {
        await mutateAsync({ id, patch, previous });
        return DONE;
      } catch (error) {
        return isUniqueViolation(error)
          ? { ok: false, error: duplicateNameMessage(patch.name ?? previous.name) }
          : TOASTED;
      }
    },
    [cache, mutateAsync],
  );
  return update;
}

/* ───────────────────────────────── delete ───────────────────────────────── */

type DeleteVars = { label: Label; links: TaskLabelLink[] };

/** Returns `deleteLabel(label)`. The label and its chips disappear at once; the DB cascades. */
export function useDeleteLabel() {
  const cache = useLabelCache();
  const { mutate } = useMutation({
    mutationKey: LABEL_WRITE_KEY,
    scope: LABEL_WRITE_SCOPE,
    networkMode: 'always',
    mutationFn: async ({ label }: DeleteVars) => {
      const { error } = await supabase.from('labels').delete().eq('id', label.id);
      if (error) throw error;
    },
    onError: (error, { label, links }) => {
      cache.updateLabels((list) => upsertLabel(list, label));
      cache.updateLinks((current) =>
        links.reduce((acc, l) => addLink(acc, l.task_id, l.label_id), current),
      );
      showErrorToast("Couldn't delete label", error, () => remove(label));
    },
    onSettled: () => cache.settle(),
  });

  const remove = useCallback(
    (label: Label): void => {
      if (isTempId(label.id)) return;
      const links = linksForLabel(cache.links(), label.id);
      cache.updateLabels((list) => removeLabel(list, label.id));
      cache.updateLinks((current) => removeLinksForLabel(current, label.id));
      mutate({ label, links });
    },
    [cache, mutate],
  );
  return remove;
}

/* ───────────────────────────── attach / detach ───────────────────────────── */

type ToggleVars = { taskId: string; labelId: string; on: boolean };

/** Returns `toggleTaskLabel(taskId, labelId, on)`. No-op for temp ids or when already in that state. */
export function useToggleTaskLabel() {
  const cache = useLabelCache();
  const { mutate } = useMutation({
    mutationKey: LABEL_WRITE_KEY,
    scope: LABEL_WRITE_SCOPE,
    networkMode: 'always',
    mutationFn: async ({ taskId, labelId, on }: ToggleVars) => {
      if (on) {
        const { error } = await supabase
          .from('task_labels')
          .insert({ task_id: taskId, label_id: labelId });
        // Already linked (e.g. from another tab): the goal state holds.
        if (error && !isUniqueViolation(error)) throw error;
      } else {
        const { error } = await supabase
          .from('task_labels')
          .delete()
          .eq('task_id', taskId)
          .eq('label_id', labelId);
        if (error) throw error;
      }
    },
    onError: (error, { taskId, labelId, on }) => {
      cache.updateLinks((links) =>
        on ? removeLink(links, taskId, labelId) : addLink(links, taskId, labelId),
      );
      showErrorToast(
        on ? "Couldn't add label" : "Couldn't remove label",
        error,
        () => void toggle(taskId, labelId, on),
      );
    },
    onSettled: () => cache.settle(),
  });

  const toggle = useCallback(
    (taskId: string, labelId: string, on: boolean): boolean => {
      if (!taskId || isTempId(taskId) || isTempId(labelId)) return false;
      if (hasLink(cache.links(), taskId, labelId) === on) return false;
      cache.updateLinks((links) =>
        on ? addLink(links, taskId, labelId) : removeLink(links, taskId, labelId),
      );
      mutate({ taskId, labelId, on });
      return true;
    },
    [cache, mutate],
  );
  return toggle;
}
