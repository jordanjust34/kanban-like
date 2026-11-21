-- ═════════════════════════════════════════════════════════════
-- 0003 labels: labels, task labels, RLS, sample seeding
--
-- Same composite-FK pattern as task_assignees (see 0002).
-- Grants: none needed (Supabase default privileges; RLS restricts rows).
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
