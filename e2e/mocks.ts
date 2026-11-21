/**
 * Offline Supabase for the a11y suite: every request to the fake project URL is answered here.
 *
 *   POST /auth/v1/signup          anonymous sign-in (what `signInAnonymously()` calls) → fake session
 *   GET  /rest/v1/tasks           → TASKS fixture
 *   GET  /rest/v1/<other table>   → []   (team_members, labels, task_assignees, task_labels, …)
 *   writes to /rest/v1/*          → 201 []   (no test should write, but never hit the network)
 *   anything else on the host     → 404 JSON
 *   realtime WebSocket            → accepted and kept silent
 *   any other non-localhost URL   → aborted, so a stray real request fails loudly instead of leaking
 */
import type { Page, Route } from '@playwright/test';
import { FAKE_SUPABASE_URL, TASKS, fakeSession } from './fixtures.ts';

export type MockOptions = {
  /** `error` answers the anonymous sign-in with a 500. */
  auth?: 'ok' | 'error';
  /** `error` answers the tasks query with a 500 (board load error state). */
  tasks?: 'ok' | 'error';
  /** When set, auth and data responses wait for this promise (to hold the loading skeleton). */
  hold?: Promise<void>;
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-supabase-api-version',
};

function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { ...CORS, ...headers },
    body: JSON.stringify(body),
  });
}

function postgrestError(message: string) {
  return { code: 'XX000', details: null, hint: null, message };
}

export async function mockSupabase(page: Page, options: MockOptions = {}): Promise<void> {
  const { auth = 'ok', tasks = 'ok', hold } = options;
  const host = new URL(FAKE_SUPABASE_URL).host;

  // Block every off-origin request that isn't the fake Supabase host (registered first, so the
  // more specific Supabase handler below takes precedence: Playwright runs the latest route first).
  await page.route(
    (url) => url.hostname !== 'localhost' && url.host !== host,
    (route) => route.abort('blockedbyclient'),
  );

  await page.routeWebSocket(
    (url) => url.host === host,
    () => {
      // Not calling `connectToServer()` keeps the socket open and silent (no realtime events).
    },
  );

  await page.route(
    (url) => url.host === host,
    async (route) => {
      const request = route.request();
      const method = request.method();
      const { pathname } = new URL(request.url());

      if (method === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS });
      }

      if (hold) await hold;

      if (pathname.startsWith('/auth/v1/')) {
        if (method === 'POST' && pathname === '/auth/v1/signup') {
          return auth === 'error'
            ? json(route, 500, {
                code: 500,
                error_code: 'unexpected_failure',
                msg: 'Anonymous sign-ins are temporarily unavailable',
              })
            : json(route, 200, fakeSession());
        }
        return json(route, 404, { code: 404, error_code: 'not_found', msg: 'Not mocked' });
      }

      if (pathname.startsWith('/rest/v1/')) {
        const table = pathname.slice('/rest/v1/'.length).split('/')[0];
        if (method !== 'GET' && method !== 'HEAD') return json(route, 201, []);
        if (table === 'tasks') {
          if (tasks === 'error') return json(route, 500, postgrestError('Mocked tasks failure'));
          return json(route, 200, TASKS, { 'content-range': `0-${TASKS.length - 1}/*` });
        }
        return json(route, 200, [], { 'content-range': '*/0' });
      }

      return json(route, 404, { message: 'Not mocked' });
    },
  );
}
