import { describe, expect, it } from 'vitest';
import { getSupabaseConfigError } from '@/lib/supabase';

describe('test environment', () => {
  it('never sees real Supabase credentials, even when .env.local exists', () => {
    expect(import.meta.env.VITE_SUPABASE_URL ?? '').toBe('');
    expect(getSupabaseConfigError()).not.toBeNull();
  });

  it('blocks outbound network requests', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow('must not make network requests');
  });
});
