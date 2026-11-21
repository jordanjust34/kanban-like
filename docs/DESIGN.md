# Design — Kanban Task Board

Companion to [REQUIREMENTS.md](./REQUIREMENTS.md). Requirement IDs (FR-*, NFR-*) refer to that doc.

## 1. Design brief

Design quality is weighted heavily. The app should look polished, not like a generic todo list: clean, modern, intentional. Reference points are **Linear** (density, keyboard-first, restrained color), **Asana** (friendly board, clear cards) and **Notion** (calm typography, generous whitespace). It should feel like something a team would actually want to use every day.

Reviewers look for:
- A cohesive color palette and typography system
- Clear visual hierarchy between board sections and task cards
- Smooth drag-and-drop
- Thoughtful empty, loading and error states
- Responsive / mobile-friendly layout (a plus)

---

## 2. Architecture

```
┌──────────────────────────────┐        HTTPS (anon key + user JWT)        ┌───────────────────────────┐
│  React SPA (Vite + TS)       │ ────────────────────────────────────────▶ │  Supabase                 │
│  hosted on Vercel            │                                           │  • Auth (anonymous)       │
│                              │ ◀──────────────────────────────────────── │  • Postgres + RLS         │
│  supabase-js · TanStack Query│        PostgREST JSON / Realtime          │  • Triggers (activity)    │
└──────────────────────────────┘                                           └───────────────────────────┘
```

- **No custom backend.** The SPA talks to Supabase directly with `supabase-js`. RLS is the security boundary, so a middle tier would add latency and hosting with no security gain. (Go API is optional in the brief; see §9.)
- **Database is the source of truth.** Logic that must be trustworthy (ownership via `auth.uid()`, activity logging, `updated_at`) lives in Postgres defaults, constraints and triggers, not in client code.

### Tech choices

| Concern | Choice | Why |
|---|---|---|
| Build | Vite + React 18 + TypeScript (strict) | Fast dev loop, zero config, static output for Vercel |
| Styling | Tailwind CSS with design tokens as CSS variables | Consistent spacing and color scale in one place |
| UI primitives | Radix UI (Dialog, Popover, DropdownMenu, Tooltip) | Accessible, unstyled, so the look stays ours |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Keyboard and touch sensors, `DragOverlay`, good performance. `react-beautiful-dnd` is deprecated |
| Server state | TanStack Query | Caching, optimistic updates with rollback, retry, loading/error flags |
| Supabase client | `@supabase/supabase-js` + generated DB types | Type-safe queries (`supabase gen types typescript`) |
| Icons | `lucide-react` | Consistent stroke icons, tree-shakable |
| Toasts | `sonner` | Small, nice-looking, supports action buttons (Undo/Retry) |
| Dates | `date-fns` | Relative times ("2 hours ago"), due-date math |
| Hosting | Vercel | Free tier, Git-push deploys, env var management |

---

## 3. Data model

### 3.1 Entity overview

```
auth.users (Supabase-managed, anonymous)
   │ 1
   ├──< tasks ──< task_assignees >── team_members
   │       ├────< task_labels    >── labels
   │       ├────< comments
   │       └────< task_activity
   ├──< team_members
   └──< labels
```

Every table carries `user_id` so RLS policies stay simple and uniform. Join tables use **composite foreign keys `(id, user_id)`** so a row can only link a task and a member/label **owned by the same user**. Without that, a user who guessed another user's task UUID could attach rows to it, because FK checks bypass RLS.

### 3.2 Status values

| DB value | Column label | Accent |
|---|---|---|
| `todo` | To Do | slate |
| `in_progress` | In Progress | blue |
| `in_review` | In Review | violet |
| `done` | Done | green |

Stored as `text` + `CHECK` (as the brief specifies) instead of a Postgres enum, so values can be changed without enum migrations.

### 3.3 Ordering within a column

`tasks.position double precision`. On drop, the new position is the midpoint of the neighbours' positions (`(prev + next) / 2`; top = `first - 1`, bottom = `last + 1`). Only the moved row is written. If gaps get too small (< 1e-9), renumber that column in one batch. This covers FR-B5 at no extra cost.

### 3.4 Full SQL schema

Lives in `supabase/migrations/0001_init.sql`. This is the schema that goes in the final document.

```sql
-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Tasks (required)
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
-- Team members & assignees (advanced #1)
-- ─────────────────────────────────────────────────────────────
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

create table public.task_assignees (
  task_id    uuid not null,
  member_id  uuid not null,
  user_id    uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (task_id, member_id),
  foreign key (task_id,   user_id) references public.tasks (id, user_id)        on delete cascade,
  foreign key (member_id, user_id) references public.team_members (id, user_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Labels (advanced #4)
-- ─────────────────────────────────────────────────────────────
create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 30),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  unique (user_id, name),
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

-- ─────────────────────────────────────────────────────────────
-- Activity log (advanced #3) — written only by triggers
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

create trigger tasks_log_activity
  after insert or update on public.tasks
  for each row execute function public.log_task_activity();

-- Assignee / label change logging follows the same pattern
-- (after insert or delete on task_assignees / task_labels).
```

---

## 4. Security

### 4.1 Guest auth flow (FR-A1–A3)

1. App boots → `supabase.auth.getSession()` (session persisted in `localStorage` by supabase-js).
2. No session → `supabase.auth.signInAnonymously()`. The user gets a real `auth.users` row (`is_anonymous = true`) and a JWT with role `authenticated`.
3. Board queries run only after the session resolves. Until then the board shows its loading skeleton.
4. The bootstrap is a **module-level singleton promise**, so React StrictMode's double effects can't create two anonymous users.

Dashboard setup: **Authentication → Sign In / Providers → Allow anonymous sign-ins = ON**. Keep the default IP rate limit for anonymous sign-ins; turning on CAPTCHA (Turnstile) is listed as a hardening step in §9.

### 4.2 Row Level Security (FR-A5)

RLS is enabled on **every** table. Each owner-scoped table gets the same policy, limited to the `authenticated` role. `(select auth.uid())` is wrapped in a subselect so Postgres evaluates it once per query, not per row.

```sql
alter table public.tasks          enable row level security;
alter table public.team_members   enable row level security;
alter table public.task_assignees enable row level security;
alter table public.labels         enable row level security;
alter table public.task_labels    enable row level security;
alter table public.comments       enable row level security;
alter table public.task_activity  enable row level security;

-- Full CRUD on own rows
create policy "owner_all" on public.tasks
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Repeat "owner_all" for: team_members, task_assignees, labels, task_labels, comments

-- Activity is read-only to clients; rows come from the SECURITY DEFINER trigger
create policy "owner_read" on public.task_activity
  for select to authenticated
  using ((select auth.uid()) = user_id);
```

### 4.3 Keys and secrets (NFR-3)

- Frontend uses only `VITE_SUPABASE_URL` and the **anon / publishable** key. Both are safe to expose because RLS enforces access.
- The service-role / secret key is never used in this project.
- `.env.local` is git-ignored. `.env.example` lists variable names only.
- The assessment PDF is git-ignored (confidential).

### 4.4 Isolation test (manual, before submission)

1. Browser A: create tasks "A1", "A2".
2. Incognito B: board is empty; create "B1".
3. A reloads: sees only A1, A2. B reloads: sees only B1.
4. From B's devtools, `supabase.from('tasks').select().eq('id', '<A1 id>')` returns `[]`. An update to A1's id affects 0 rows.

---

## 5. Frontend architecture

### 5.1 Project structure

```
src/
  app/            App.tsx, providers (QueryClient, Toaster), auth bootstrap
  lib/            supabase.ts (client), database.types.ts (generated), constants (statuses, colors)
  features/
    board/        Board, Column, TaskCard, QuickAdd, DragOverlayCard, usePositions
    tasks/        api.ts (queries/mutations), TaskDetailSheet, TaskForm, useTasks
    filters/      SearchBar, FilterMenu, useFilters (URL search params)
    members/      MembersPopover, Avatar, AvatarStack, api.ts
    labels/       LabelPicker, LabelChip, api.ts
    activity/     ActivityTimeline, CommentList, CommentComposer, api.ts
    stats/        BoardStats
  components/ui/  Button, Input, Select, Badge, Skeleton, EmptyState, ErrorState, Kbd
  styles/         tokens.css, globals.css
supabase/
  migrations/0001_init.sql
```

Each feature owns its data-access module (`api.ts`) and hooks. Components never call `supabase` directly.

### 5.2 Data flow

- **Fetch board** in one request using PostgREST embedding:
  `tasks.select('*, task_assignees(member_id), task_labels(label_id)').order('position')`
  Members and labels are separate small queries cached under their own keys.
- **Group by status** on the client with `useMemo`. Filtering and search are also client-side, since a single guest's board is small.
- **Mutations** (create, move, update, delete) use TanStack Query's optimistic pattern:
  `onMutate` → snapshot cache + apply change · `onError` → restore snapshot + error toast · `onSettled` → invalidate.
- **Move on drop** sends a single `update({ status, position })` for the moved task.
- **Realtime** *(Could)*: subscribe to `postgres_changes` on `tasks` filtered by `user_id` so two tabs stay in sync. The brief accepts "real time (or on drop)", so optimistic-on-drop is the baseline.

### 5.3 Drag and drop

- `DndContext` with **Pointer** (activation distance 4 px, so clicks still open cards), **Touch** (200 ms press delay, so scrolling still works) and **Keyboard** sensors.
- Each column is a `SortableContext` (vertical list) and also a droppable, so empty columns accept drops.
- `DragOverlay` renders a lifted copy of the card (scale 1.02, 2° tilt, larger shadow). The original slot shows a dashed placeholder.
- The target column gets a subtle tinted background while a card is over it.
- Cross-column moves update local state in `onDragOver` so cards reflow live. Persist happens once in `onDragEnd`.
- Screen-reader announcements via dnd-kit `accessibility.announcements` ("Moved *Fix login* to In Review").

### 5.4 Filters & search

State lives in URL search params (`?q=login&priority=high&label=<id>&assignee=<id>`), so filters survive reloads and the browser back button works. Matching: title contains `q` (case-insensitive) AND each active filter group (OR within a group). Drag stays enabled while filtering. Hidden cards keep their positions.

### 5.5 Keyboard shortcuts

| Key | Action |
|---|---|
| `C` | New task (opens quick-add in To Do) |
| `/` | Focus search |
| `Esc` | Close detail sheet / clear search |
| `Enter` on focused card | Open detail |
| `Space` on focused card | Pick up / drop (dnd-kit keyboard) |

---

## 6. Visual design system

### 6.1 Principles

1. **Calm canvas, colorful content.** Neutral surfaces. Color is reserved for meaning: status, priority, labels, urgency.
2. **Hierarchy through surface, not borders.** Board background < column surface < card surface. Each layer is a step lighter, with soft shadows.
3. **Dense but breathable.** Linear-like 13–14 px UI text, 4 px spacing grid, generous gutters between columns.
4. **Motion with purpose.** 150–200 ms ease-out transitions. Drag gets a spring-like settle. Nothing bounces for decoration.

### 6.2 Color tokens (light theme)

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#F7F7F8` | Board background |
| `--bg-column` | `#EFEFF1` | Column surface |
| `--bg-card` | `#FFFFFF` | Cards, sheets, popovers |
| `--border` | `#E4E4E7` | Hairlines, inputs |
| `--text-primary` | `#18181B` | Titles |
| `--text-secondary` | `#52525B` | Body, metadata |
| `--text-muted` | `#A1A1AA` | Placeholders, counts |
| `--accent` | `#5E6AD2` | Primary buttons, focus ring, links (Linear-esque indigo) |
| `--danger` | `#E5484D` | Overdue, destructive, errors |
| `--warning` | `#F5A524` | Due soon |
| `--success` | `#30A46C` | Done, success toasts |

**Status accents** (column header dot + 2 px top bar): To Do `#8B8D98` · In Progress `#3E63DD` · In Review `#8E4EC6` · Done `#30A46C`.

**Priority** (small icon + text on card): High = red bars icon · Normal = blue · Low = gray. Shown with an icon, not color alone (accessibility).

**Label / member palette** (user picks from 8 swatches; chips use a 12 % tint background + full-strength text):
`#E5484D` `#F76B15` `#F5A524` `#30A46C` `#12A594` `#3E63DD` `#8E4EC6` `#D6409F`

Light theme only. Dark mode is out of scope (D14).

### 6.3 Typography

- **Font:** Inter (variable), with `font-feature-settings: "cv11", "ss01"` and tabular numbers for counts and dates. System-ui fallback.

| Role | Size / line-height | Weight |
|---|---|---|
| Page title | 20 / 28 | 600 |
| Column header | 13 / 20, uppercase-free, letter-spacing −0.01em | 600 |
| Card title | 14 / 20 | 500 |
| Body / description | 14 / 22 | 400 |
| Meta (dates, counts, chips) | 12 / 16 | 500 |

### 6.4 Spacing, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32 px.
- Radius: 6 px (chips, inputs) · 8 px (cards, buttons) · 12 px (columns, sheets).
- Shadows: card `0 1px 2px rgb(0 0 0 / .06)`; card hover `0 2px 8px rgb(0 0 0 / .08)`; dragging `0 12px 24px rgb(0 0 0 / .16)`.
- Column width: 300 px desktop. Gutter 16 px.

---

## 7. Screens & components

### 7.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◆ Board name         [ 12 total · 5 done · 2 overdue ]     ◐◑◒ +   [+ New task]│  header
│ [🔍 Search tasks…  /]  [Priority ▾] [Assignee ▾] [Label ▾]   × Clear filters  │  toolbar
├──────────────────────────────────────────────────────────────────────────────┤
│ ● To Do  4   +   │ ● In Progress 3 + │ ● In Review 1  +  │ ● Done  4      +  │
│ ┌──────────────┐ │ ┌──────────────┐  │ ┌──────────────┐  │ ┌──────────────┐  │
│ │ Bug  Design  │ │ │ ...          │  │ │ ...          │  │ │ ...          │  │
│ │ Fix login bug│ │ └──────────────┘  │ └──────────────┘  │ └──────────────┘  │
│ │ ▮▮▮ High     │ │                   │                   │                   │
│ │ ⚠ Overdue 2d ◐◑│                   │                   │                   │
│ └──────────────┘ │                   │                   │                   │
│ + Add task       │                   │                   │                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                         Task detail opens as a right-side sheet ▶
```

### 7.2 Task card (top to bottom; empty rows are omitted)

1. Label chips (max 3, then "+N")
2. Title (2-line clamp)
3. Meta row: priority icon · due-date badge · comment count · assignee avatar stack (max 3, then "+N")

Hover: lift shadow and a "⋯" quick menu (move to…, delete). Focus: 2 px accent ring.

### 7.3 Due-date badge logic (advanced #5)

| Condition (local date, task not Done) | Badge |
|---|---|
| `due < today` | red, ⚠ "Overdue · 2d" |
| `due = today` | amber, "Today" |
| `due ≤ today + 2` | amber, "Tue" / "Tomorrow" |
| later | neutral, "Nov 28" |
| task is Done | neutral, struck color, never red |

Implemented as a pure function `getDueUrgency(dueDate, status, today)` with unit tests.

### 7.4 Task detail sheet

Right-side Radix Dialog (full-screen on mobile). Inline-editable title. Property grid: Status, Priority, Due date, Assignees, Labels. Markdown-free description textarea (autosaves on blur). Tabs or stacked sections: **Comments** (composer at bottom, ⌘/Ctrl+Enter to send) and **Activity** (timeline, newest last, e.g. "Moved from To Do → In Progress · 2 hours ago"). Comments and activity can be merged into one chronological feed, like Linear.

### 7.5 Board stats (advanced #7)

Compact pill group in the header: **Total**, **Done** (with % and a thin progress bar), **Overdue** (red only when > 0). Derived from the cached task list, so it updates instantly.

### 7.6 States (FR-S1–S4)

| State | Treatment |
|---|---|
| Booting session / first load | 4 skeleton columns with 2–3 shimmering card placeholders. Header renders immediately |
| Load failed | Centered `ErrorState`: icon, "Couldn't load your board", short reason, **Retry** button |
| Mutation failed | Card snaps back; toast "Couldn't move task — check your connection" with **Retry** |
| Offline | Thin banner "You're offline — changes will fail until you reconnect" (`navigator.onLine`) |
| Empty board (first run) | Friendly illustration/emoji + "Plan your first task" + primary button. Optionally a "Add sample tasks" link |
| Empty column | Muted dashed drop zone: "No tasks" / "Drop here" while dragging |
| No search/filter results | "No tasks match your filters" + **Clear filters** |
| Saving | Inline subtle spinner on the card / "Saving…" in the sheet. Never blocks the UI |

### 7.7 Responsive

| Breakpoint | Layout |
|---|---|
| ≥ 1024 px | All 4 columns visible; detail is a 480 px side sheet |
| 640–1023 px | Horizontal scroll, columns 280 px |
| < 640 px | Columns 85 vw with scroll-snap (one column per screen, next one peeking); toolbar collapses into a filter button; detail sheet full-screen; touch drag after long-press |

---

## 8. Quality, testing, deployment

- **Code quality:** TS strict, ESLint (typescript-eslint, react-hooks), Prettier. Generated DB types are committed so the build doesn't need Supabase CLI access.
- **Unit tests (Vitest):** `getDueUrgency`, `positionBetween`, filter matching, stats derivation.
- **Manual checklist:** RLS isolation test (§4.4), drag on touch device, keyboard drag, offline toggle in devtools, slow-3G throttling to see skeletons.
- **Optional E2E (Playwright):** create → drag → reload → verify column.
- **Deploy:** Vercel project linked to GitHub `main`; env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` set in the Vercel dashboard. Preview deploys per PR.
- **Local setup (for README / final doc):** clone → `npm i` → copy `.env.example` to `.env.local` and fill in the values → run `supabase/migrations/0001_init.sql` in the Supabase SQL editor → enable anonymous sign-ins → `npm run dev`.

---

## 9. Decisions & tradeoffs

| Decision | Tradeoff / what we'd do with more time |
|---|---|
| No Go backend | Simpler and faster to ship. RLS covers security. A backend would matter for rate limiting, webhooks or heavy aggregation |
| Anonymous auth only | Clearing browser storage loses the board. Next step: "Save your board" that links an email to the anonymous user (`updateUser` / identity linking) |
| Abuse of anonymous sign-up | Relies on Supabase's default IP rate limit. Next step: Cloudflare Turnstile CAPTCHA plus a cron job to purge stale anonymous users |
| Client-side filtering & stats | Fine for one guest's board (tens to hundreds of tasks). At scale, move to server-side queries and a stats view/RPC |
| Fractional `position` | One-row writes per move. Needs occasional renumbering; a LexoRank string would avoid float precision limits |
| Team members aren't real users | Matches the brief ("small team" with name + avatar). Real collaboration would need workspaces, invites and membership-based RLS |
| Text + CHECK for status/priority | Easy to evolve. User-defined columns would need a `columns` table |
| Activity via DB trigger | Can't be skipped or forged by the client. Payloads are minimal (field names, not full diffs) |

## 10. Build plan (maps to time budget)

1. **Foundation (~1.5 h):** Vite/TS/Tailwind scaffold, tokens, Supabase project, migration, anon auth bootstrap, deploy a skeleton to Vercel early.
2. **Core board (~2 h):** fetch + group, columns, cards, quick-add, create dialog, dnd-kit move + optimistic persist, loading/error/empty states. → **all Musts done**
3. **Polish pass (~1 h):** motion, drag overlay, responsive, keyboard, focus states.
4. **Advanced, in order:** due-date badges → stats → search/filters → members & assignees → labels → detail sheet with activity → comments.
5. **Wrap-up (~1 h):** README, RLS isolation test, screenshots, final PDF.

## 11. Decision log (grilling session, 2026-11-20)

| # | Decision |
|---|---|
| D1 | Web app (Vite + React + TS), responsive. No React Native |
| D2 | No Go backend. Supabase called directly from the SPA; listed as a tradeoff |
| D3 | Budget ~8–10 h. All Musts shipped and deployed by ~hour 4 |
| D4 | Tailwind + CSS-variable tokens + Radix primitives, styled by us (shadcn snippets OK if restyled) |
| D5 | TanStack Query for server state and optimistic updates |
| D6 | Persist on drop (optimistic). Supabase Realtime is a stretch goal |
| D7 | Within-column reordering included (fractional `position`) |
| D8 | Schema via Supabase CLI migrations in `supabase/migrations/` (`npx supabase`); fallback is a single SQL file pasted into the editor |
| D9 | New guests are **auto-seeded** with sample data |
| D10 | Advanced features committed: 5 (due dates) → 7 (stats) → 6 (search/filter) → 1 (members) → 4 (labels). 3 (activity) and 2 (comments) only if time allows |
| D11 | Seeding via `AFTER INSERT ON auth.users` trigger (`SECURITY DEFINER`), never client-side |
| D12 | Delete = immediate optimistic removal + 5 s **Undo** toast; the DB delete is sent when the toast expires |
| D13 | Per-column quick-add (title, Enter) **and** a header "New task" dialog with all fields |
| D14 | Light theme only. Dark mode dropped from scope (2026-11-21) |
| D15 | Fixed board name, no settings UI: **"Next Play · Sprint Board"** |

### Seed data (D9/D11)

The trigger inserts with `user_id = new.id` explicitly. `auth.uid()` is null during sign-up, so the column defaults can't be relied on. Content:
- **8 tasks** spread over all four columns, mixing priorities and due dates: one overdue, one due today, one due in 2 days, the rest later or none. This shows off the badges and stats immediately.
- **3 team members** (distinct palette colors) and **4 labels** (Bug, Feature, Design, Chore), with some assigned to tasks. Member/label rows are only inserted once those tables exist (features 1 and 4).
- Any error in this trigger blocks sign-up, so keep it minimal and test it with a fresh incognito session after every change.
