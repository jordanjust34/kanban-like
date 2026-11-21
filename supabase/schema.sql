-- ═════════════════════════════════════════════════════════════
-- Kanban Task Board: full database schema (Supabase / Postgres 17)
--
-- READ-ONLY COPY for documentation. The source of truth is the three
-- migrations in supabase/migrations/, applied in order with
-- `npx supabase db push`. This file is their plain concatenation
-- (regenerate it if a migration changes); running it once on an empty
-- Supabase project produces the same schema.
--
--   20261120000001_init.sql     tasks, RLS, seed_10_tasks
--   20261120000002_members.sql  team_members, task_assignees, seed_20_members
--   20261120000003_labels.sql   labels, task_labels, seed_30_labels
-- ═════════════════════════════════════════════════════════════


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
