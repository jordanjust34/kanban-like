/**
 * Automated isolation test (DESIGN §4.4, IMPLEMENTATION_PLAN X7).
 *
 *   npm run rls-check
 *
 * Signs in two fresh anonymous guests (A and B) against the live project with the
 * publishable key only (never a service key), then checks that:
 *   - A sees exactly its own seeded sample data,
 *   - B can't read, update, delete or forge rows belonging to A,
 *   - B can't link its own rows to A's rows (composite FKs / RLS),
 *   - A's data is unchanged afterwards.
 * Prints PASS/FAIL per check and exits with code 1 on any failure.
 * Each run leaves two anonymous users (with their seed data) behind; that's accepted.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const EXPECTED = { tasks: 8, members: 3, labels: 4, assignees: 5, taskLabels: 7 } as const;

type Owned = { user_id: string };
type TaskRow = Owned & { id: string; title: string; status: string; updated_at: string };
type IdRow = Owned & { id: string };
type AssigneeRow = Owned & { task_id: string; member_id: string };
type TaskLabelRow = Owned & { task_id: string; label_id: string };

type Snapshot = {
  tasks: TaskRow[];
  members: IdRow[];
  labels: IdRow[];
  assignees: AssigneeRow[];
  taskLabels: TaskLabelRow[];
};

type Guest = { name: string; client: SupabaseClient; userId: string };

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function signIn(name: string): Promise<Guest> {
  const client = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(`${name}: anonymous sign-in failed: ${error?.message ?? 'no user returned'}`);
  }
  return { name, client, userId: data.user.id };
}

async function selectAll<T>(client: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const { data, error } = await client.from(table).select(columns);
  if (error) throw new Error(`select from ${table} failed: ${error.message}`);
  return data as T[];
}

async function snapshot(client: SupabaseClient): Promise<Snapshot> {
  const [tasks, members, labels, assignees, taskLabels] = await Promise.all([
    selectAll<TaskRow>(client, 'tasks', 'id, user_id, title, status, updated_at'),
    selectAll<IdRow>(client, 'team_members', 'id, user_id'),
    selectAll<IdRow>(client, 'labels', 'id, user_id'),
    selectAll<AssigneeRow>(client, 'task_assignees', 'task_id, member_id, user_id'),
    selectAll<TaskLabelRow>(client, 'task_labels', 'task_id, label_id, user_id'),
  ]);
  return { tasks, members, labels, assignees, taskLabels };
}

/** Stable string form of a snapshot, for before/after comparison. */
function fingerprint(s: Snapshot): string {
  const sorted = Object.fromEntries(
    Object.entries(s).map(([k, rows]) => [
      k,
      (rows as object[]).map((r) => JSON.stringify(r)).sort(),
    ]),
  );
  return JSON.stringify(sorted);
}

function allOwnedBy(s: Snapshot, userId: string): boolean {
  return Object.values(s).every((rows: Owned[]) => rows.every((r) => r.user_id === userId));
}

/** Runs a write that must be rejected; passes only if Postgres returns an error. */
async function expectRejected(
  name: string,
  write: PromiseLike<{ error: { message: string; code?: string } | null }>,
): Promise<void> {
  const { error } = await write;
  check(name, error !== null, error ? `${error.code ?? ''} ${error.message}`.trim() : 'succeeded');
}

async function main(): Promise<void> {
  if (!url || !key) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
  }

  const guests: Guest[] = [];
  try {
    const a = await signIn('A');
    guests.push(a);
    const b = await signIn('B');
    guests.push(b);
    console.log(`A = ${a.userId}\nB = ${b.userId}\n`);

    // ── A sees its seeded sample data, and only its own rows ──
    const aBefore = await snapshot(a.client);
    check(
      `A sees ${EXPECTED.tasks} seeded tasks`,
      aBefore.tasks.length === EXPECTED.tasks,
      `${aBefore.tasks.length}`,
    );
    check(
      `A sees ${EXPECTED.members} team members`,
      aBefore.members.length === EXPECTED.members,
      `${aBefore.members.length}`,
    );
    check(
      `A sees ${EXPECTED.labels} labels`,
      aBefore.labels.length === EXPECTED.labels,
      `${aBefore.labels.length}`,
    );
    check(
      `A sees ${EXPECTED.assignees} seeded assignee links`,
      aBefore.assignees.length === EXPECTED.assignees,
      `${aBefore.assignees.length}`,
    );
    check(
      `A sees ${EXPECTED.taskLabels} seeded label links`,
      aBefore.taskLabels.length === EXPECTED.taskLabels,
      `${aBefore.taskLabels.length}`,
    );
    check('All rows A sees belong to A', allOwnedBy(aBefore, a.userId));

    const aTask = aBefore.tasks[0];
    const aMember = aBefore.members[0];
    if (!aTask || !aMember)
      throw new Error('A has no seeded task/member to attack; seed trigger failed?');

    // ── B is isolated from A ──
    const bOwn = await snapshot(b.client);
    check('All rows B sees belong to B', allOwnedBy(bOwn, b.userId));
    const bTask = bOwn.tasks[0];
    const bMember = bOwn.members[0];
    const bLabel = bOwn.labels[0];

    const sel = await b.client.from('tasks').select('id').eq('id', aTask.id);
    check(
      "B selecting A's task by id returns 0 rows",
      !sel.error && (sel.data?.length ?? 0) === 0,
      sel.error?.message ?? `${sel.data?.length ?? 0} rows`,
    );

    const selMember = await b.client.from('team_members').select('id').eq('id', aMember.id);
    check(
      "B selecting A's member by id returns 0 rows",
      !selMember.error && (selMember.data?.length ?? 0) === 0,
      selMember.error?.message ?? `${selMember.data?.length ?? 0} rows`,
    );

    const upd = await b.client
      .from('tasks')
      .update({ title: 'pwned by B' })
      .eq('id', aTask.id)
      .select('id');
    check(
      "B updating A's task affects 0 rows",
      (upd.data?.length ?? 0) === 0,
      upd.error?.message ?? `${upd.data?.length ?? 0} rows`,
    );

    const del = await b.client.from('tasks').delete().eq('id', aTask.id).select('id');
    check(
      "B deleting A's task affects 0 rows",
      (del.data?.length ?? 0) === 0,
      del.error?.message ?? `${del.data?.length ?? 0} rows`,
    );

    await expectRejected(
      'B inserting a task with user_id = A is rejected',
      b.client.from('tasks').insert({ title: 'Forged by B', user_id: a.userId }),
    );

    if (bTask && bMember && bLabel) {
      await expectRejected(
        "B linking B's member to A's task is rejected",
        b.client.from('task_assignees').insert({ task_id: aTask.id, member_id: bMember.id }),
      );
      await expectRejected(
        "B linking A's member to B's task is rejected",
        b.client.from('task_assignees').insert({ task_id: bTask.id, member_id: aMember.id }),
      );
      await expectRejected(
        "B linking B's label to A's task is rejected",
        b.client.from('task_labels').insert({ task_id: aTask.id, label_id: bLabel.id }),
      );
    } else {
      check('B has seeded rows to run the cross-link checks with', false, 'seed missing for B');
    }
    await expectRejected(
      "B inserting a link between A's rows with user_id = A is rejected",
      b.client
        .from('task_assignees')
        .insert({ task_id: aTask.id, member_id: aMember.id, user_id: a.userId }),
    );

    // ── A is unaffected ──
    const aAfter = await snapshot(a.client);
    check("A's data is unchanged after B's attempts", fingerprint(aAfter) === fingerprint(aBefore));
  } finally {
    await Promise.all(guests.map((g) => g.client.auth.signOut()));
  }
}

try {
  await main();
} catch (err) {
  failures += 1;
  console.error(`FAIL  ${err instanceof Error ? err.message : String(err)}`);
}

console.log(failures === 0 ? '\nAll RLS checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
