/**
 * Comments + activity data access (advanced #2, #3). The only module that talks to `comments`
 * and `task_activity`.
 *
 * * `task_activity` is read-only here: DB triggers write it. `useActivity` is always stale, and
 *   `useRefreshActivityOnChange` refetches it whenever the task list or the task's links change.
 * * Comment writes follow the labels pattern: apply to the cache synchronously under a temp id →
 *   send → on error roll back just that row + toast with Retry → refetch once the last comment
 *   write has settled. One mutation scope keeps them in order.
 *
 * Cache keys add the user id to the frozen `queryKeys` entries, so another guest's comments
 * never show; prefix invalidation (`queryKeys.comments(taskId)`) still matches. `user_id` is never
 * sent: the DB default (`auth.uid()`) fills it.
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
  addComment,
  addCountRow,
  commentBody,
  removeComment,
  removeCountRow,
  replaceComment,
  toCommentCountMap,
  type ActivityEntry,
  type Comment,
  type CommentCountRow,
} from './model';

export type { ActivityEntry, Comment } from './model';

const COMMENT_WRITE_KEY = ['comments', 'write'] as const;
const COMMENT_WRITE_SCOPE = { id: 'comment-writes' };

export function activityQueryKey(taskId: string, userId: string | null) {
  return [...queryKeys.activity(taskId), userId] as const;
}

export function commentsQueryKey(taskId: string, userId: string | null) {
  return [...queryKeys.comments(taskId), userId] as const;
}

export function commentCountsQueryKey(userId: string | null) {
  return [...queryKeys.commentCounts, userId] as const;
}

/** Signed-in user id once the session is ready; also drops another user's cached rows. */
function useUserId(): string | null {
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session.status === 'ready' ? (session.session.user?.id ?? null) : null;

  useEffect(() => {
    if (!userId) return;
    // activity / comments keys are [name, taskId, userId]; counts are [name, userId].
    queryClient.removeQueries({
      predicate: ({ queryKey }) =>
        ((queryKey[0] === 'activity' || queryKey[0] === 'comments') &&
          queryKey.length === 3 &&
          queryKey[2] !== userId) ||
        (queryKey[0] === queryKeys.commentCounts[0] && queryKey[1] !== userId),
    });
  }, [queryClient, userId]);

  return userId;
}

function currentUserId(queryClient: QueryClient): string | null {
  return queryClient.getQueryData<Session>(queryKeys.session)?.user.id ?? null;
}

/* ─────────────────────────────────── reads ─────────────────────────────────── */

async function fetchActivity(taskId: string): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('task_activity')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

async function fetchComments(taskId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function fetchCommentCountRows(): Promise<CommentCountRow[]> {
  const { data, error } = await supabase.from('comments').select('task_id');
  if (error) throw error;
  return data;
}

/** The task's activity log, oldest first. Always stale: triggers write it behind our back. */
export function useActivity(taskId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: activityQueryKey(taskId, userId),
    queryFn: () => fetchActivity(taskId),
    enabled: userId !== null && !isTempId(taskId),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

/** The task's comments, oldest first. */
export function useComments(taskId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: commentsQueryKey(taskId, userId),
    queryFn: () => fetchComments(taskId),
    enabled: userId !== null && !isTempId(taskId),
  });
}

/** Comment count per task for the whole board, from one query. */
export function useCommentCounts(): Map<string, number> | undefined {
  const userId = useUserId();
  const { data } = useQuery({
    queryKey: commentCountsQueryKey(userId),
    queryFn: fetchCommentCountRows,
    enabled: userId !== null,
    // Module-level function: TanStack only re-runs it when the rows change.
    select: toCommentCountMap,
  });
  return data;
}

/** How long to wait after a task / link cache change before refetching the activity. */
const ACTIVITY_REFRESH_DELAY_MS = 250;

const WATCHED = new Set<unknown>([
  queryKeys.tasks[0],
  queryKeys.taskAssignees[0],
  queryKeys.taskLabels[0],
]);

/**
 * Refetches the task's activity whenever the task list or the assignee / label links change in
 * the cache (a refetch after a write, an optimistic edit, or a Realtime update). Debounced, so an
 * optimistic edit followed by its confirming refetch costs one request; if the early request
 * races the write, the later refetch's invalidate cancels and repeats it.
 */
export function useRefreshActivityOnChange(taskId: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isTempId(taskId)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      if (!WATCHED.has(event.query.queryKey[0])) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.activity(taskId) });
      }, ACTIVITY_REFRESH_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient, taskId]);
}

/* ─────────────────────────────── cache plumbing ─────────────────────────────── */

type CommentCache = {
  comments(taskId: string): Comment[];
  updateComments(taskId: string, fn: (list: Comment[]) => Comment[]): void;
  updateCounts(fn: (rows: CommentCountRow[]) => CommentCountRow[]): void;
  settle(taskId: string): void;
};

function useCommentCache(): CommentCache {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const listKey = (taskId: string) => commentsQueryKey(taskId, currentUserId(queryClient));
    return {
      comments: (taskId) => queryClient.getQueryData<Comment[]>(listKey(taskId)) ?? [],
      updateComments: (taskId, fn) => {
        const key = listKey(taskId);
        void queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<Comment[]>(key, (old) => (old ? fn(old) : old));
      },
      updateCounts: (fn) => {
        const key = commentCountsQueryKey(currentUserId(queryClient));
        void queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<CommentCountRow[]>(key, (old) => (old ? fn(old) : old));
      },
      settle: (taskId) => {
        if (queryClient.isMutating({ mutationKey: COMMENT_WRITE_KEY }) <= 1) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.comments(taskId) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.commentCounts });
        }
      },
    };
  }, [queryClient]);
}

/* ─────────────────────────────────── add ─────────────────────────────────── */

type AddVars = { taskId: string; body: string; tempId: string };

/**
 * Returns `addComment(taskId, text)`. The comment (and its card count) shows at once under a temp
 * id. Returns `false` without sending when the text is invalid or the task isn't saved yet.
 */
export function useAddComment() {
  const cache = useCommentCache();
  const { mutate } = useMutation({
    mutationKey: COMMENT_WRITE_KEY,
    scope: COMMENT_WRITE_SCOPE,
    networkMode: 'always',
    mutationFn: async ({ taskId, body }: AddVars) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({ task_id: taskId, body })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (comment, { taskId, tempId }) => {
      cache.updateComments(taskId, (list) => replaceComment(list, tempId, comment));
    },
    onError: (error, { taskId, body, tempId }) => {
      cache.updateComments(taskId, (list) => removeComment(list, tempId));
      cache.updateCounts((rows) => removeCountRow(rows, taskId));
      showErrorToast("Couldn't add comment", error, () => void add(taskId, body));
    },
    onSettled: (_data, _error, { taskId }) => cache.settle(taskId),
  });

  const add = useCallback(
    (taskId: string, text: string): boolean => {
      const body = commentBody(text);
      if (body === null || !taskId || isTempId(taskId)) return false;
      const tempId = makeTempId();
      cache.updateComments(taskId, (list) =>
        addComment(list, {
          id: tempId,
          task_id: taskId,
          user_id: '',
          body,
          created_at: new Date().toISOString(),
        }),
      );
      cache.updateCounts((rows) => addCountRow(rows, taskId));
      mutate({ taskId, body, tempId });
      return true;
    },
    [cache, mutate],
  );
  return add;
}

/* ─────────────────────────────────── delete ─────────────────────────────────── */

/** Returns `deleteComment(comment)`. It disappears at once; restored with a toast on failure. */
export function useDeleteComment() {
  const cache = useCommentCache();
  const { mutate } = useMutation({
    mutationKey: COMMENT_WRITE_KEY,
    scope: COMMENT_WRITE_SCOPE,
    networkMode: 'always',
    mutationFn: async (comment: Comment) => {
      const { error } = await supabase.from('comments').delete().eq('id', comment.id);
      if (error) throw error;
    },
    onError: (error, comment) => {
      cache.updateComments(comment.task_id, (list) =>
        list.some((c) => c.id === comment.id) ? list : addComment(list, comment),
      );
      cache.updateCounts((rows) => addCountRow(rows, comment.task_id));
      showErrorToast("Couldn't delete comment", error, () => remove(comment));
    },
    onSettled: (_data, _error, comment) => cache.settle(comment.task_id),
  });

  const remove = useCallback(
    (comment: Comment): void => {
      if (isTempId(comment.id)) return;
      cache.updateComments(comment.task_id, (list) => removeComment(list, comment.id));
      cache.updateCounts((rows) => removeCountRow(rows, comment.task_id));
      mutate(comment);
    },
    [cache, mutate],
  );
  return remove;
}
