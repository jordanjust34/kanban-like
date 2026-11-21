# Task Manager — Assessment Submission

Name: TODO

## 1. Overview and design decisions

The solution is a Kanban task board in the style of Linear or Asana. A visitor lands straight on a
board (no sign-up): an anonymous guest session is created on first load and seeded with sample
tasks, team members and labels. Tasks move between four columns (To Do, In Progress, In Review,
Done) by drag and drop with mouse, touch or keyboard, can be reordered within a column, and can be
created, edited and deleted. Everything persists in Supabase and survives a reload.

The main design decisions:

- **A deliberate design system.** Neutral surfaces with color reserved for meaning (status,
  priority, urgency, labels); hierarchy through layered surfaces rather than borders; Inter with
  tabular numbers; a 4 px spacing grid; short, purposeful motion. All values are CSS-variable
  tokens consumed through Tailwind, and the interactive primitives (dialog, sheet, popover, menus)
  are Radix components styled to those tokens. Light theme only: dark mode was dropped to spend
  the time on core polish. Loading, empty, error and offline states are designed, not defaults.
- **Optimistic UX.** Every write (move, reorder, create, edit, assign, label, delete) updates the
  TanStack Query cache immediately, then sends the request. On failure the snapshot is restored
  and a toast explains what happened and offers Retry. Delete removes the card at once and shows
  a 5-second Undo toast; the DELETE is sent only when the toast closes.
- **RLS-first security, no backend.** The React SPA calls Supabase directly with the publishable
  key and the guest's JWT. Row Level Security on every table is the security boundary, so a custom
  API tier would add latency and hosting without adding protection. Logic that must be
  trustworthy (ownership, timestamps, sample data, the activity log) lives in Postgres defaults,
  constraints and triggers.
- **A parallel, contract-first build.** Requirements and design were written first (with a
  decision log), then shared contracts (domain types, query keys, URL-state helpers and fixed
  "slot" components) so several coding agents could build features in parallel git worktrees,
  each owning a disjoint set of files. Each phase ended at a gate: merge, review, run the checks
  and the app. CI (types, lint, tests, build, database checks, accessibility, secret and
  dependency scanning, CodeQL) runs on every pull request.

## 2. Live frontend URL

https://kanban-like.vercel.app

## 3. GitHub repository

https://github.com/jordanjust34/kanban-like

## 4. Database schema (SQL)

Screenshot of the Supabase table editor: TODO (add before export)

Seven tables, all with Row Level Security and an owner-only policy:

| Table            | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `tasks`          | Title, description, status, priority, due date, position   |
| `team_members`   | Name, color, optional avatar URL                           |
| `task_assignees` | Task ↔ member links (many-to-many)                         |
| `labels`         | Name (unique per user) and color                           |
| `task_labels`    | Task ↔ label links (many-to-many)                          |
| `comments`       | Comment body per task                                      |
| `task_activity`  | History written only by triggers; read-only to clients     |

Below is the full schema: the six migrations in `supabase/migrations/`, in the order they are
applied.

```sql
-- >>> 20261120000001_init.sql

-- ═════════════════════════════════════════════════════════════
-- 0001 init: tasks table, RLS, and per-user sample-task seeding
--
-- Grants: table privileges for `authenticated` are added in 0004_api_grants
-- (this project does not auto-grant new tables). Row Level Security (below)
-- is what restricts each user to their own rows.
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
-- search_path pinned to '' (only uses pg_catalog's now()) so the
-- Supabase linter does not flag a mutable search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Tasks
-- ─────────────────────────────────────────────────────────────
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  description  text check (char_length(description) <= 5000),
  status       text not null default 'todo'
                 check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority     text not null default 'normal'
                 check (priority in ('low', 'normal', 'high')),
  due_date     date,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)                       -- target for composite FKs
);

create index tasks_board_idx on public.tasks (user_id, status, position);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: full CRUD on own rows only
-- ─────────────────────────────────────────────────────────────
alter table public.tasks enable row level security;

create policy "owner_all" on public.tasks
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Seed: 8 sample tasks for every new (anonymous) user
--
-- Runs as an AFTER INSERT trigger on auth.users. Triggers fire in name
-- order, so seed_10_tasks runs before seed_20_members / seed_30_labels,
-- which attach to these tasks by title.
--
-- * auth.uid() is NULL during sign-up, so user_id = new.id is explicit.
-- * SECURITY DEFINER + search_path = '' : every name is schema-qualified.
-- * Error handling: an exception escaping this trigger would roll back the
--   auth.users insert and BLOCK SIGN-UP. Sample data is nice-to-have, a
--   working sign-in is not, so failures are caught, logged with
--   RAISE WARNING (visible in the Postgres logs) and swallowed. The
--   exception block is a subtransaction: a failed seed leaves no partial
--   rows, and the user simply starts with an empty board.
-- ─────────────────────────────────────────────────────────────
create or replace function public.seed_new_user_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.tasks
      (user_id, title, description, status, priority, due_date, position)
    values
      -- To Do
      (new.id, 'Fix login redirect loop',
       'Users with an expired session bounce between /login and /dashboard. Clear the stale token before redirecting and add a regression test.',
       'todo', 'high', current_date - 3, 1000),
      (new.id, 'Design onboarding empty states',
       'First-run screens for projects, reports and team with a short explanation and one clear call to action each.',
       'todo', 'normal', current_date + 7, 2000),
      (new.id, 'Write release notes for v2.4',
       'Summarise the new export options and the notification settings for the changelog and in-app banner.',
       'todo', 'low', null, 3000),
      -- In Progress
      (new.id, 'Migrate billing webhooks to the new API',
       'Stripe retires the old event version next month. Move handlers over, keep them idempotent, and replay last week''s events in staging.',
       'in_progress', 'high', current_date, 1000),
      (new.id, 'Add CSV export to reports',
       'Export the current report view (filters applied) as CSV. Large exports should stream instead of timing out.',
       'in_progress', 'normal', current_date + 14, 2000),
      -- In Review
      (new.id, 'Speed up dashboard initial load',
       'Lazy-load the charts and drop the unused date library. Target: under 1.5 s on a mid-range phone.',
       'in_review', 'normal', current_date + 2, 1000),
      (new.id, 'Update password reset email copy',
       'Shorter subject line, clearer button text, and mention that the link expires after 30 minutes.',
       'in_review', 'low', null, 2000),
      -- Done (past due date on purpose: done tasks are never shown as overdue)
      (new.id, 'Set up error monitoring alerts',
       'Alert the on-call channel when the error rate passes 2% for five minutes.',
       'done', 'normal', current_date - 5, 1000);
  exception when others then
    raise warning 'seed_new_user_tasks failed for user %: % (SQLSTATE %)',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

-- Only the trigger may call this; it is not part of the client API.
revoke execute on function public.seed_new_user_tasks() from public, anon, authenticated;

create trigger seed_10_tasks
  after insert on auth.users
  for each row execute function public.seed_new_user_tasks();


-- >>> 20261120000002_members.sql

-- ═════════════════════════════════════════════════════════════
-- 0002 members: team members, task assignees, RLS, sample seeding
--
-- Join rows use composite FKs (id, user_id), so a task can only be linked
-- to a member owned by the same user. FK checks bypass RLS, so without
-- this a user who guessed another user's task id could attach rows to it.
--
-- Grants: added in 0004_api_grants (RLS restricts rows).
-- ═════════════════════════════════════════════════════════════

create table public.team_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  color       text not null default '#6366F1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);

create index team_members_user_idx on public.team_members (user_id);

create table public.task_assignees (
  task_id    uuid not null,
  member_id  uuid not null,
  user_id    uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (task_id, member_id),
  foreign key (task_id,   user_id) references public.tasks (id, user_id)        on delete cascade,
  foreign key (member_id, user_id) references public.team_members (id, user_id) on delete cascade
);

-- RLS filter + "tasks of this member" / member-delete cascade lookups.
-- (task_id lookups are covered by the primary key.)
create index task_assignees_user_idx   on public.task_assignees (user_id);
create index task_assignees_member_idx on public.task_assignees (member_id, user_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.team_members   enable row level security;
alter table public.task_assignees enable row level security;

create policy "owner_all" on public.team_members
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner_all" on public.task_assignees
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Seed: 3 members + 5 assignments to the tasks from seed_10_tasks
-- (found by user_id + title). Same error handling as 0001: log and
-- swallow, never block sign-up. If the task seed failed, the joins
-- below simply match nothing.
-- ─────────────────────────────────────────────────────────────
create or replace function public.seed_new_user_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.team_members (user_id, name, color, avatar_url)
    values
      (new.id, 'Maya Chen',   '#8E4EC6', null),
      (new.id, 'Leo Martins', '#12A594', null),
      (new.id, 'Priya Shah',  '#F76B15', null);

    insert into public.task_assignees (task_id, member_id, user_id)
    select t.id, m.id, new.id
    from (values
      ('Fix login redirect loop',                 'Leo Martins'),
      ('Design onboarding empty states',          'Maya Chen'),
      ('Migrate billing webhooks to the new API', 'Leo Martins'),
      ('Migrate billing webhooks to the new API', 'Priya Shah'),
      ('Speed up dashboard initial load',         'Priya Shah')
    ) as v (task_title, member_name)
    join public.tasks t
      on t.user_id = new.id and t.title = v.task_title
    join public.team_members m
      on m.user_id = new.id and m.name = v.member_name;
  exception when others then
    raise warning 'seed_new_user_members failed for user %: % (SQLSTATE %)',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

revoke execute on function public.seed_new_user_members() from public, anon, authenticated;

create trigger seed_20_members
  after insert on auth.users
  for each row execute function public.seed_new_user_members();


-- >>> 20261120000003_labels.sql

-- ═════════════════════════════════════════════════════════════
-- 0003 labels: labels, task labels, RLS, sample seeding
--
-- Same composite-FK pattern as task_assignees (see 0002).
-- Grants: added in 0004_api_grants (RLS restricts rows).
-- ═════════════════════════════════════════════════════════════

create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  unique (user_id, name),                    -- also serves user_id lookups
  unique (id, user_id)
);

create table public.task_labels (
  task_id   uuid not null,
  label_id  uuid not null,
  user_id   uuid not null default auth.uid(),
  primary key (task_id, label_id),
  foreign key (task_id,  user_id) references public.tasks (id, user_id)  on delete cascade,
  foreign key (label_id, user_id) references public.labels (id, user_id) on delete cascade
);

-- RLS filter + label-delete cascade lookups (task_id is covered by the PK).
create index task_labels_user_idx  on public.task_labels (user_id);
create index task_labels_label_idx on public.task_labels (label_id, user_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.labels      enable row level security;
alter table public.task_labels enable row level security;

create policy "owner_all" on public.labels
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner_all" on public.task_labels
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Seed: 4 labels + 7 links to the tasks from seed_10_tasks (by title).
-- Some tasks get two labels, some none. Same error handling as 0001.
-- ─────────────────────────────────────────────────────────────
create or replace function public.seed_new_user_labels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.labels (user_id, name, color)
    values
      (new.id, 'Bug',     '#E5484D'),
      (new.id, 'Feature', '#3E63DD'),
      (new.id, 'Design',  '#D6409F'),
      (new.id, 'Chore',   '#F5A524');

    insert into public.task_labels (task_id, label_id, user_id)
    select t.id, l.id, new.id
    from (values
      ('Fix login redirect loop',                 'Bug'),
      ('Design onboarding empty states',          'Design'),
      ('Design onboarding empty states',          'Feature'),
      ('Add CSV export to reports',               'Feature'),
      ('Speed up dashboard initial load',         'Bug'),
      ('Speed up dashboard initial load',         'Chore'),
      ('Migrate billing webhooks to the new API', 'Chore')
    ) as v (task_title, label_name)
    join public.tasks t
      on t.user_id = new.id and t.title = v.task_title
    join public.labels l
      on l.user_id = new.id and l.name = v.label_name;
  exception when others then
    raise warning 'seed_new_user_labels failed for user %: % (SQLSTATE %)',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

revoke execute on function public.seed_new_user_labels() from public, anon, authenticated;

create trigger seed_30_labels
  after insert on auth.users
  for each row execute function public.seed_new_user_labels();


-- >>> 20261120000004_api_grants.sql

-- ═════════════════════════════════════════════════════════════
-- 0004 API grants
--
-- This project does NOT auto-grant new `public` tables to the API roles
-- (the earlier migrations' "no grants needed" comments were wrong), so
-- PostgREST returned "permission denied". Grant table privileges to
-- `authenticated` only: anonymous guests sign in and get that role.
-- `anon` (no session) gets nothing. RLS still limits every row to its owner.
-- ═════════════════════════════════════════════════════════════

grant select, insert, update, delete on table
  public.tasks,
  public.team_members,
  public.task_assignees,
  public.labels,
  public.task_labels
to authenticated;


-- >>> 20261121000005_seed_us_central_dates.sql

-- ═════════════════════════════════════════════════════════════
-- 0005 seed dates in US Central time
--
-- seed_new_user_tasks() used current_date, which is the UTC date. For a
-- guest signing up in a US evening, that is already tomorrow, so the
-- sample "due today" task showed as "Tomorrow" and the overdue one was a
-- day short. Use the America/Chicago calendar date instead: correct for
-- reviewers in the US, still off by one for users far from US time
-- (documented in the README).
--
-- Only the function body changes; the seed_10_tasks trigger and its
-- grants are unchanged.
-- ═════════════════════════════════════════════════════════════

create or replace function public.seed_new_user_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Sample due dates are relative to the US Central calendar date, not UTC:
  -- in a US evening UTC is already tomorrow, which shifted every sample date
  -- by a day ("due today" showed as "Tomorrow").
  today date := (now() at time zone 'America/Chicago')::date;
begin
  begin
    insert into public.tasks
      (user_id, title, description, status, priority, due_date, position)
    values
      -- To Do
      (new.id, 'Fix login redirect loop',
       'Users with an expired session bounce between /login and /dashboard. Clear the stale token before redirecting and add a regression test.',
       'todo', 'high', today - 3, 1000),
      (new.id, 'Design onboarding empty states',
       'First-run screens for projects, reports and team with a short explanation and one clear call to action each.',
       'todo', 'normal', today + 7, 2000),
      (new.id, 'Write release notes for v2.4',
       'Summarise the new export options and the notification settings for the changelog and in-app banner.',
       'todo', 'low', null, 3000),
      -- In Progress
      (new.id, 'Migrate billing webhooks to the new API',
       'Stripe retires the old event version next month. Move handlers over, keep them idempotent, and replay last week''s events in staging.',
       'in_progress', 'high', today, 1000),
      (new.id, 'Add CSV export to reports',
       'Export the current report view (filters applied) as CSV. Large exports should stream instead of timing out.',
       'in_progress', 'normal', today + 14, 2000),
      -- In Review
      (new.id, 'Speed up dashboard initial load',
       'Lazy-load the charts and drop the unused date library. Target: under 1.5 s on a mid-range phone.',
       'in_review', 'normal', today + 2, 1000),
      (new.id, 'Update password reset email copy',
       'Shorter subject line, clearer button text, and mention that the link expires after 30 minutes.',
       'in_review', 'low', null, 2000),
      -- Done (past due date on purpose: done tasks are never shown as overdue)
      (new.id, 'Set up error monitoring alerts',
       'Alert the on-call channel when the error rate passes 2% for five minutes.',
       'done', 'normal', today - 5, 1000);
  exception when others then
    raise warning 'seed_new_user_tasks failed for user %: % (SQLSTATE %)',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end $$;

revoke execute on function public.seed_new_user_tasks() from public, anon, authenticated;


-- >>> 20261121000006_activity_comments_realtime.sql

-- ═════════════════════════════════════════════════════════════
-- 0006 comments, activity log, Realtime
--
-- * comments: owner-only CRUD, like every other table.
-- * task_activity: written ONLY by SECURITY DEFINER triggers, so the client
--   can't skip or forge history. Clients get read access (RLS owner_read).
-- * Realtime: tasks, links and comments join the supabase_realtime
--   publication so other tabs of the same guest stay in sync. Realtime
--   respects RLS for row payloads.
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Comments (advanced #2)
-- ─────────────────────────────────────────────────────────────
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null,
  user_id     uuid not null default auth.uid(),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index comments_task_idx on public.comments (task_id, created_at);
create index comments_user_idx on public.comments (user_id);

alter table public.comments enable row level security;

create policy "owner_all" on public.comments
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.comments to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Activity log (advanced #3)
-- ─────────────────────────────────────────────────────────────
create table public.task_activity (
  id          bigint generated always as identity primary key,
  task_id     uuid not null,
  user_id     uuid not null,
  kind        text not null check (kind in
                ('created', 'status_changed', 'edited',
                 'assignee_added', 'assignee_removed', 'label_added', 'label_removed')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index task_activity_task_idx on public.task_activity (task_id, created_at);
create index task_activity_user_idx on public.task_activity (user_id);

alter table public.task_activity enable row level security;

-- Read-only for clients: rows only come from the triggers below.
create policy "owner_read" on public.task_activity
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.task_activity to authenticated;

-- Task created / status changed / fields edited. Position-only updates
-- (reordering within a column) are not logged.
create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[];
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, user_id, kind, payload)
    values (new.id, new.user_id, 'created', jsonb_build_object('title', new.title));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, user_id, kind, payload)
    values (new.id, new.user_id, 'status_changed',
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  changed := array_remove(array[
    case when new.title       is distinct from old.title       then 'title'       end,
    case when new.description is distinct from old.description then 'description' end,
    case when new.priority    is distinct from old.priority    then 'priority'    end,
    case when new.due_date    is distinct from old.due_date    then 'due_date'    end
  ], null);

  if cardinality(changed) > 0 then
    insert into public.task_activity (task_id, user_id, kind, payload)
    values (new.id, new.user_id, 'edited', jsonb_build_object('fields', changed));
  end if;

  return new;
end $$;

revoke execute on function public.log_task_activity() from public, anon, authenticated;

create trigger tasks_log_activity
  after insert or update on public.tasks
  for each row execute function public.log_task_activity();

-- Assignee / label added or removed.
--
-- Skipped when:
-- * auth.uid() is null: the sign-up seed triggers. Sample links are not
--   "activity" the guest performed.
-- * the task no longer exists: deleting a task cascades to its links, and
--   logging against the deleted task would violate the FK and BLOCK the delete.
-- * the member / label no longer exists: deleting a member or label cascades
--   to its links; that is not an edit of each task.
create or replace function public.log_link_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  link     record;
  is_label boolean := tg_table_name = 'task_labels';
  ref_id   uuid;
  ref_name text;
  ref_color text;
begin
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'INSERT' then link := new; else link := old; end if;

  if not exists (select 1 from public.tasks t where t.id = link.task_id) then
    return null;
  end if;

  if is_label then
    ref_id := link.label_id;
    select l.name, l.color into ref_name, ref_color from public.labels l where l.id = ref_id;
  else
    ref_id := link.member_id;
    select m.name, m.color into ref_name, ref_color from public.team_members m where m.id = ref_id;
  end if;

  if ref_name is null then
    return null;
  end if;

  insert into public.task_activity (task_id, user_id, kind, payload)
  values (
    link.task_id,
    link.user_id,
    case
      when is_label and tg_op = 'INSERT' then 'label_added'
      when is_label                      then 'label_removed'
      when tg_op = 'INSERT'              then 'assignee_added'
      else                                    'assignee_removed'
    end,
    jsonb_build_object('id', ref_id, 'name', ref_name, 'color', ref_color)
  );
  return null;
end $$;

revoke execute on function public.log_link_activity() from public, anon, authenticated;

create trigger task_assignees_log_activity
  after insert or delete on public.task_assignees
  for each row execute function public.log_link_activity();

create trigger task_labels_log_activity
  after insert or delete on public.task_labels
  for each row execute function public.log_link_activity();

-- ─────────────────────────────────────────────────────────────
-- Realtime: keep other tabs of the same guest in sync (row payloads
-- are filtered by RLS).
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime
  add table public.tasks, public.task_assignees, public.task_labels, public.comments;
```

## 5. Local setup

Requirements: Node (recent LTS; CI uses Node 26) and a free Supabase project.

1. Clone and install:
   ```sh
   git clone https://github.com/jordanjust34/kanban-like.git
   cd kanban-like
   npm ci
   ```
2. In the Supabase dashboard, enable guest sign-in: Authentication → Sign In / Providers →
   Allow anonymous sign-ins = ON.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Use the publishable key, never the
   secret / service-role key.
4. Apply the schema, either with the Supabase CLI:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   or by running each file in `supabase/migrations/` in filename order in the SQL editor.
5. Start the app with `npm run dev` and open the printed URL.

Useful scripts: `npm test` (unit and component tests), `npm run test:a11y` (Playwright + axe),
`npm run rls-check` (two-guest isolation test against the project in `.env.local`),
`npm run typecheck`, `npm run lint`, `npm run build`.

## 6. Advanced features

All seven advanced features from the assessment brief were built, plus Realtime sync between tabs.

**Due-date indicators.** Cards show a due badge: red "Overdue · Nd", amber for today, tomorrow
or the day after, and a neutral date otherwise; tasks in Done are never shown as overdue. A pure
function compares calendar days (dates are parsed as local dates, so there is no UTC off-by-one),
and a hook advances "today" at midnight so badges stay correct in a long-open tab.

**Board summary / stats.** The header shows total tasks, completed (with a percentage) and
overdue. The numbers are derived on render from the same cached task list the board uses, with
the same overdue rule as the red badge, so they update instantly with every optimistic change.

**Search and filtering.** A search box filters cards by title as you type (case-insensitive; `/`
focuses it) and filter menus narrow by priority, assignee and label, with active filters shown as
clearable chips. All filter state lives in the URL (`?q=`, `?priority=`, `?assignee=`,
`?label=`), so filtered views can be shared and the back button undoes a filter. Filter groups
plug into a small registry; options within a group are OR-ed and groups are AND-ed.

**Team members and assignees.** Members (name, color from an accessible palette, optional avatar
URL) can be added, edited and removed from the header, where they also appear as an avatar
stack. Tasks can have several assignees, chosen in the detail sheet and shown as avatars on the
card. Members and the `task_assignees` link table are owner-scoped by RLS, and composite foreign
keys prevent linking to another user's task or member.

**Labels / tags.** Labels can be created, renamed, recolored and deleted from the picker in the
detail sheet; a task can carry several, shown as tinted chips on the card, and the board can be
filtered by label. Names are unique per user, enforced by a database constraint.

**Activity log.** The detail sheet shows a timeline of the task's history, e.g. "You moved from
To Do → In Progress · 2 hours ago": created, moved between columns, fields edited, assignees and
labels added or removed. It refreshes as soon as the task changes, without a reload. It is written entirely by
`SECURITY DEFINER` triggers on `tasks`, `task_assignees` and `task_labels`; clients can only read
`task_activity`, so history cannot be skipped or forged. Reordering within a column and the
sample assignee and label links created at sign-up are deliberately not logged.

**Comments.** Comments appear in the same chronological feed as the activity (oldest first, with
relative timestamps), like Linear. The composer at the bottom auto-grows and sends with
⌘/Ctrl+Enter; comments are added optimistically and can be deleted after an inline
confirmation. Cards show a comment count. They are stored in a separate `comments` table
(1–2000 characters, owner-only RLS, cascade-deleted with the task).

**Realtime multi-tab sync.** `tasks`, the two link tables and `comments` are published to
Supabase Realtime. Each tab subscribes to changes on the guest's own rows and refetches the
affected queries (debounced, and postponed while a drag or a write is in flight), so a second tab
stays in sync without fighting optimistic state.

## 7. Tradeoffs and future improvements

- **No backend.** Faster to build, and RLS covers security. A server would be worth adding for
  rate limiting, webhooks or heavy aggregation.
- **Anonymous guests only.** Clearing browser storage loses the board. Next: a "Save your board"
  flow that links an email to the anonymous user. Abuse currently relies on Supabase's default IP
  rate limit; next would be a CAPTCHA (Turnstile) and a scheduled purge of stale guests.
- **Sample due dates use US Central time.** The seed trigger computes "today" in America/Chicago
  so the sample badges read correctly for US reviewers; a guest far from US time may see them off
  by a day. A fix is to pass the browser's time zone at sign-up.
- **Client-side filtering and stats.** Right for one guest's board; at scale they would move to
  server-side queries and a stats view or RPC.
- **Team members are not real users.** Real collaboration would need workspaces, invitations and
  membership-based RLS.
- **Fractional positions.** Each move writes one row, with occasional renumbering of a column; a
  LexoRank-style string key would avoid float precision limits.
- **Fixed columns.** User-defined columns would need a `columns` table instead of a CHECK
  constraint on status.
- **More end-to-end coverage.** Unit, component and accessibility tests run in CI; next would be
  Playwright flows for drag and drop and multi-tab sync against a local Supabase stack.
