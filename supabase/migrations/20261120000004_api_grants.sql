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
