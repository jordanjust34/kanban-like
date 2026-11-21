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
