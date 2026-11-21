import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isSyncedTable, keysToInvalidate, SYNCED_TABLES, type SyncedTable } from './syncPlan';

/** Batch bursts of changes (e.g. a renumbered column) into one refetch. */
const DEBOUNCE_MS = 300;
/** While a drag or a local write is in flight, check again after this long. */
const BUSY_RETRY_MS = 500;

/** A refetch mid-drag or mid-optimistic-write would fight the local state; wait instead. */
function isBusy(queryClient: QueryClient) {
  return queryClient.isMutating() > 0 || document.querySelector('[data-dragging]') !== null;
}

/**
 * Keeps other tabs of the same guest in sync (DESIGN §5.2, Realtime "Could").
 *
 * Subscribes to Postgres changes on the guest's own rows and refetches the affected queries.
 * Row payloads are ignored on purpose: refetching through the normal query path keeps one source
 * of truth (and RLS) and reuses every `select` mapping. Own writes echo back too; the extra
 * refetch is cheap and debounced. Renders nothing.
 */
export function RealtimeSync({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pending = new Set<SyncedTable>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hasConnected = false;

    const flush = () => {
      timer = undefined;
      if (isBusy(queryClient)) {
        timer = setTimeout(flush, BUSY_RETRY_MS);
        return;
      }
      const keys = keysToInvalidate(pending);
      pending.clear();
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    const schedule = (table: SyncedTable) => {
      pending.add(table);
      if (timer === undefined) timer = setTimeout(flush, DEBOUNCE_MS);
    };

    let channel = supabase.channel(`board-sync:${userId}`);
    for (const table of SYNCED_TABLES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (change) => {
          if (isSyncedTable(change.table)) schedule(change.table);
        },
      );
    }
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // After a reconnect, events may have been missed: refetch everything once.
      if (hasConnected) for (const table of SYNCED_TABLES) schedule(table);
      hasConnected = true;
    });

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return null;
}
