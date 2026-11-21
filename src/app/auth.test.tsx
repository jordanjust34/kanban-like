import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSession, resetSessionForTests, useSession } from './auth';

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<unknown>>(),
  signInAnonymously: vi.fn<() => Promise<unknown>>(),
  onAuthStateChange: vi.fn<(listener: AuthListener) => unknown>(),
  configError: { current: null as Error | null },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
  getSupabaseConfigError: () => mocks.configError.current,
}));

const fakeSession = (id: string) =>
  ({ access_token: `token-${id}`, user: { id } }) as unknown as Session;

const noSession = { data: { session: null }, error: null };
const signedIn = (session: Session) => ({ data: { session, user: session.user }, error: null });
const signInFailed = (message: string) => ({
  data: { session: null, user: null },
  error: new Error(message),
});

let listeners: AuthListener[] = [];

beforeEach(() => {
  resetSessionForTests();
  vi.resetAllMocks();
  mocks.configError.current = null;
  listeners = [];
  mocks.onAuthStateChange.mockImplementation((listener: AuthListener) => {
    listeners.push(listener);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners = listeners.filter((l) => l !== listener);
          },
        },
      },
    };
  });
});

describe('ensureSession', () => {
  it('shares one anonymous sign-in between concurrent callers', async () => {
    const session = fakeSession('guest');
    mocks.getSession.mockResolvedValue(noSession);
    mocks.signInAnonymously.mockResolvedValue(signedIn(session));

    const [a, b] = await Promise.all([ensureSession(), ensureSession()]);

    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(session);
    expect(b).toBe(session);
  });

  it('reuses an existing session without signing in', async () => {
    const session = fakeSession('returning');
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(ensureSession()).resolves.toBe(session);
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it('rejects on sign-in error, then retries on the next call', async () => {
    const session = fakeSession('second-try');
    mocks.getSession.mockResolvedValue(noSession);
    mocks.signInAnonymously
      .mockResolvedValueOnce(signInFailed('rate limited'))
      .mockResolvedValueOnce(signedIn(session));

    await expect(ensureSession()).rejects.toThrow('rate limited');
    await expect(ensureSession()).resolves.toBe(session);
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('rejects with a clear message when config is missing', async () => {
    mocks.configError.current = new Error(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local',
    );

    await expect(ensureSession()).rejects.toThrow(/copy \.env\.example to \.env\.local/);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });
});

describe('useSession', () => {
  function setup() {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, ...renderHook(() => useSession(), { wrapper }) };
  }

  it('goes loading → ready', async () => {
    const session = fakeSession('guest');
    mocks.getSession.mockResolvedValue(noSession);
    mocks.signInAnonymously.mockResolvedValue(signedIn(session));

    const { result } = setup();
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ status: 'ready', session });
  });

  it('goes error → retry → ready', async () => {
    const session = fakeSession('guest');
    mocks.getSession.mockResolvedValue(noSession);
    mocks.signInAnonymously
      .mockResolvedValueOnce(signInFailed('network down'))
      .mockResolvedValueOnce(signedIn(session));

    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({ error: new Error('network down') });

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ status: 'ready', session });
  });

  it('follows token refreshes and boots a new guest after sign-out', async () => {
    const first = fakeSession('first');
    const refreshed = fakeSession('first-refreshed');
    const second = fakeSession('second');
    mocks.getSession.mockResolvedValue(noSession);
    mocks.signInAnonymously
      .mockResolvedValueOnce(signedIn(first))
      .mockResolvedValueOnce(signedIn(second));

    const { result } = setup();
    await waitFor(() => expect(result.current).toMatchObject({ session: first }));

    act(() => listeners.forEach((l) => l('TOKEN_REFRESHED', refreshed)));
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'ready', session: refreshed }),
    );
    await expect(ensureSession()).resolves.toBe(refreshed);

    act(() => listeners.forEach((l) => l('SIGNED_OUT', null)));
    await waitFor(() => expect(result.current).toMatchObject({ session: second }));
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(2);
  });
});
