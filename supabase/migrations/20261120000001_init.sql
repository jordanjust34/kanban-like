-- ═════════════════════════════════════════════════════════════
-- 0001 init: tasks table, RLS, and per-user sample-task seeding
--
-- Grants: none needed. Supabase's default privileges already grant
-- table access in `public` to the `anon` / `authenticated` roles;
-- Row Level Security (below) is what restricts each user to their own rows.
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
