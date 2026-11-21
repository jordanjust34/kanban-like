/**
 * The one Supabase client for the app (DESIGN §4.1, §4.3).
 * Uses only the public URL + publishable key; RLS protects the data.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const missing = [
  url ? null : 'VITE_SUPABASE_URL',
  key ? null : 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter((name): name is string => name !== null);

const configError =
  missing.length > 0
    ? new Error(`Missing ${missing.join(' / ')} — copy .env.example to .env.local`)
    : null;

/** Non-null when the env vars are missing. `ensureSession()` rejects with it, so the shell can show it. */
export function getSupabaseConfigError(): Error | null {
  return configError;
}

/*
 * Missing-config design: `createClient` throws on an empty URL, which would crash at import time and
 * leave a blank page. Instead we always build a client, using inert placeholders when misconfigured
 * (`.invalid` is a reserved TLD that never resolves). That keeps `supabase` typed as non-null for the
 * rest of the app. Every data query waits for `ensureSession()`, which checks
 * `getSupabaseConfigError()` first and rejects with a readable message, so the placeholder client
 * never makes a request.
 */
export const supabase = createClient<Database>(
  url || 'https://missing-supabase-config.invalid',
  key || 'missing-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
