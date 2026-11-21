import { useMutationState, type Mutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/lib/queryKeys';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** How long "Saved" lingers before the indicator goes quiet. */
const SAVED_VISIBLE_MS = 2000;

/** True for a `useUpdateTask` mutation of `taskId` whose patch touches `field`. */
function isFieldUpdate(variables: unknown, taskId: string, field: string): boolean {
  if (typeof variables !== 'object' || variables === null) return false;
  if (!('id' in variables) || variables.id !== taskId) return false;
  if (!('patch' in variables)) return false;
  const { patch } = variables;
  return typeof patch === 'object' && patch !== null && field in patch;
}

/**
 * "Saving…" / "Saved" for one field of one task, read from TanStack's mutation cache (the task
 * API is fire-and-forget and returns only a boolean). Wrap the write in `track(() => update(…))`:
 * only mutations submitted from then on count.
 */
export function useSaveState(taskId: string, field: string) {
  const [since, setSince] = useState<number | null>(null);

  const statuses = useMutationState({
    filters: {
      mutationKey: queryKeys.tasks,
      predicate: (mutation: Mutation<unknown, Error, unknown, unknown>) =>
        since !== null &&
        mutation.state.submittedAt >= since &&
        isFieldUpdate(mutation.state.variables, taskId, field),
    },
    select: (mutation) => mutation.state.status,
  });

  const latest = statuses.at(-1);
  const state: SaveState =
    since === null || latest === undefined
      ? since === null
        ? 'idle'
        : 'saving'
      : latest === 'pending' || latest === 'idle'
        ? 'saving'
        : latest === 'success'
          ? 'saved'
          : 'error';

  useEffect(() => {
    if (state !== 'saved') return;
    const timer = setTimeout(() => setSince(null), SAVED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  // A fresh id (different task opened in the same sheet) starts quiet.
  const [trackedId, setTrackedId] = useState(taskId);
  if (trackedId !== taskId) {
    setTrackedId(taskId);
    setSince(null);
  }

  return {
    state,
    /** Runs the write and tracks it; a write that wasn't sent (returned false) stays quiet. */
    track: (write: () => boolean) => {
      const startedAt = Date.now();
      setSince(write() ? startedAt : null);
    },
  };
}
