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
