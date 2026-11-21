/**
 * Fake Supabase data for the a11y suite. Nothing here is a real credential: the URL uses the
 * reserved `.test` TLD and every request to it is intercepted by `e2e/mocks.ts`.
 */

export const FAKE_SUPABASE_URL = 'http://supabase.test';
export const FAKE_SUPABASE_KEY = 'sb_publishable_test';

export const GUEST_USER_ID = '00000000-0000-4000-8000-000000000001';

/** Same shape as `Tables<'tasks'>` in `src/lib/database.types.ts` (kept structural on purpose). */
export type TaskRow = {
  created_at: string;
  description: string | null;
  due_date: string | null;
  id: string;
  position: number;
  priority: string;
  status: string;
  title: string;
  updated_at: string;
  user_id: string;
};

const CREATED = '2026-01-05T09:00:00.000Z';

function task(
  n: number,
  status: string,
  title: string,
  extra: Partial<Pick<TaskRow, 'description' | 'due_date' | 'priority'>> = {},
): TaskRow {
  return {
    id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`,
    user_id: GUEST_USER_ID,
    status,
    title,
    description: extra.description ?? null,
    due_date: extra.due_date ?? null,
    priority: extra.priority ?? 'normal',
    position: n * 1000,
    created_at: CREATED,
    updated_at: CREATED,
  };
}

/** 8 tasks across all four statuses, with a mix of priorities, due dates and descriptions. */
export const TASKS: TaskRow[] = [
  task(1, 'todo', 'Draft the onboarding checklist', { priority: 'high', due_date: '2026-01-10' }),
  task(2, 'todo', 'Collect feedback from the beta group', { description: 'Use the survey form.' }),
  task(3, 'todo', 'Update the pricing page copy', { priority: 'low' }),
  task(4, 'in_progress', 'Fix login redirect on Safari', { priority: 'high' }),
  task(5, 'in_progress', 'Write release notes for v2.3', { due_date: '2026-01-20' }),
  task(6, 'in_review', 'Refactor the notifications service', { description: 'PR #142' }),
  task(7, 'done', 'Set up the staging environment', { priority: 'low' }),
  task(8, 'done', 'Migrate analytics to the new schema'),
];

/** Opened through `?task=<id>` to scan the detail sheet once it exists. */
export const DETAIL_TASK_ID = TASKS[0]!.id;

/** Session payload in the shape `@supabase/auth-js` `_sessionResponse` expects from `/signup`. */
export function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: GUEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: '',
    phone: '',
    app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
    user_metadata: {},
    identities: [],
    created_at: CREATED,
    updated_at: CREATED,
    last_sign_in_at: CREATED,
    is_anonymous: true,
  };
  // JWT-shaped (unsigned, fake) in case supabase-js decodes the claims; nothing verifies it.
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ sub: GUEST_USER_ID, role: 'authenticated', is_anonymous: true, exp: now + 3600 }),
    'fake-signature',
  ].join('.');
  return {
    access_token: accessToken,
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };
}
