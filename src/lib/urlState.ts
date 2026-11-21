/**
 * UI state that lives in the URL search params (IMPLEMENTATION_PLAN §1 X4).
 * FROZEN: only the main session edits this file.
 *
 *   ?q=login&priority=high&priority=low&assignee=<id>&label=<id>   board filters (multi-value = repeated key)
 *   ?task=<id>                                                     task detail sheet
 *   ?new=<status>                                                  create-task dialog, preset to a column
 *
 * No router: plain URLSearchParams + history API, with a tiny subscription so
 * React re-renders on our own updates and on back/forward (popstate).
 */
import { useCallback, useSyncExternalStore } from 'react';

export type ParamKey = 'q' | 'priority' | 'assignee' | 'label' | 'task' | 'new';

/** `push` adds a history entry (opening a sheet); `replace` doesn't (typing in search). */
export type HistoryMode = 'push' | 'replace';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('popstate', notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', notify);
  };
}

function getSearch() {
  return window.location.search;
}

/**
 * Apply several param changes in one history entry.
 * `null` / empty string / empty array removes the key. Arrays write repeated keys.
 */
export function setSearchParams(
  changes: Partial<Record<ParamKey, string | readonly string[] | null>>,
  mode: HistoryMode = 'replace',
) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    params.delete(key);
    if (value == null) continue;
    const values = typeof value === 'string' ? [value] : value;
    for (const v of values) if (v !== '') params.append(key, v);
  }
  const search = params.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  if (url === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  notify();
}

/** Re-renders whenever the query string changes. */
export function useSearchString(): string {
  return useSyncExternalStore(subscribe, getSearch, () => '');
}

/** Single-value param (`q`, `task`, `new`). Returns `null` when absent. */
export function useSearchParam(
  key: ParamKey,
): [string | null, (value: string | null, mode?: HistoryMode) => void] {
  const search = useSearchString();
  const value = new URLSearchParams(search).get(key);
  const set = useCallback(
    (next: string | null, mode: HistoryMode = 'replace') => setSearchParams({ [key]: next }, mode),
    [key],
  );
  return [value, set];
}

/** Multi-value param (`priority`, `assignee`, `label`). Returns `[]` when absent. */
export function useSearchParamList(
  key: ParamKey,
): [string[], (values: readonly string[], mode?: HistoryMode) => void] {
  const search = useSearchString();
  const values = new URLSearchParams(search).getAll(key);
  const set = useCallback(
    (next: readonly string[], mode: HistoryMode = 'replace') =>
      setSearchParams({ [key]: next }, mode),
    [key],
  );
  return [values, set];
}

/** Convenience helpers used across features. */
export const openTask = (id: string) => setSearchParams({ task: id, new: null }, 'push');
export const openCreateTask = (status: string = 'todo') =>
  setSearchParams({ new: status, task: null }, 'push');
export const closeOverlay = () => setSearchParams({ task: null, new: null }, 'replace');
