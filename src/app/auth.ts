/**
 * Guest session bootstrap (DESIGN §4.1). CONTRACT STUB from Phase 1 scaffold:
 * the signatures below are fixed; the P1 "auth" agent implements the bodies.
 */
import type { Session } from '@supabase/supabase-js';

export type SessionState =
  { status: 'loading' } | { status: 'ready'; session: Session } | { status: 'error'; error: Error };

/**
 * Resolves with the current session, signing in anonymously if there is none.
 * Module-level singleton: concurrent calls share one promise (StrictMode-safe).
 * A failed attempt resets the singleton so a later call retries.
 */
export function ensureSession(): Promise<Session> {
  return Promise.reject(new Error('ensureSession not implemented yet'));
}

/** React hook over `ensureSession()`. `retry` re-runs the bootstrap after an error. */
export function useSession(): SessionState & { retry: () => void } {
  return { status: 'loading', retry: () => {} };
}
