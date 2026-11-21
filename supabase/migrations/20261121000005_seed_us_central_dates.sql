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
