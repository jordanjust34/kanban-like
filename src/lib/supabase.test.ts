import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('./supabase');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabase client config', () => {
  it('reports missing env vars with a clear message instead of crashing on import', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const { getSupabaseConfigError, supabase } = await loadModule();

    expect(supabase).toBeDefined();
    expect(getSupabaseConfigError()?.message).toBe(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local',
    );
  });

  it('names only the variable that is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const { getSupabaseConfigError } = await loadModule();

    expect(getSupabaseConfigError()?.message).toBe(
      'Missing VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local',
    );
  });

  it('has no config error when both values are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    const { getSupabaseConfigError } = await loadModule();

    expect(getSupabaseConfigError()).toBeNull();
  });
});
