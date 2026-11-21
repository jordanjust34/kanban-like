/**
 * Guest session bootstrap (DESIGN §4.1).
 * The exported signatures are the Phase 1 contract; the shell is built against them.
 */
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import { getSupabaseConfigError, supabase } from '@/lib/supabase';

export type SessionState =
  { status: 'loading' } | { status: 'ready'; session: Session } | { status: 'error'; error: Error };

/** Module-level singleton: StrictMode double effects and concurrent callers share one sign-in. */
let sessionPromise: Promise<Session> | null = null;

async function bootstrapSession(): Promise<Session> {
  const configError = getSupabaseConfigError();
  if (configError) throw configError;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const signIn = await supabase.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
  if (!signIn.data.session) throw new Error('Anonymous sign-in returned no session');
  return signIn.data.session;
}

/**
 * Resolves with the current session, signing in anonymously if there is none.
 * Module-level singleton: concurrent calls share one promise (StrictMode-safe).
 * A failed attempt resets the singleton so a later call retries.
 */
export function ensureSession(): Promise<Session> {
  sessionPromise ??= bootstrapSession().catch((error: unknown) => {
    sessionPromise = null;
    throw error instanceof Error ? error : new Error(String(error));
  });
  return sessionPromise;
}

/** TEST-ONLY: clears the singleton so each test starts from a fresh boot. Never call from app code. */
export function resetSessionForTests(): void {
  sessionPromise = null;
}

/** React hook over `ensureSession()`. `retry` re-runs the bootstrap after an error. */
export function useSession(): SessionState & { retry: () => void } {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: ensureSession,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Keep the singleton and the cached session in sync with supabase-js (token refresh, sign-out).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionPromise = null;
        // Deferred: supabase-js warns against triggering auth calls inside this callback.
        // Resetting refetches the active query, which boots a fresh guest session.
        setTimeout(() => void queryClient.resetQueries({ queryKey: queryKeys.session }), 0);
        return;
      }
      if (
        session &&
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED')
      ) {
        sessionPromise = Promise.resolve(session);
        queryClient.setQueryData(queryKeys.session, session);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);

  if (query.isSuccess) return { status: 'ready', session: query.data, retry };
  // While a retry is in flight, report loading rather than the stale error.
  if (query.isError && !query.isFetching) return { status: 'error', error: query.error, retry };
  return { status: 'loading', retry };
}
