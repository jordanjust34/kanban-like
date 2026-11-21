# Kanban Task Board

A polished, Linear-style Kanban board for managing a small team's work: drag tasks between
columns, assign teammates, tag with labels, filter, comment, and see every change in an activity
timeline. Built with React + TypeScript on Supabase, with Postgres Row Level Security as the only
security boundary.

**[Live demo → kanban-like.vercel.app](https://kanban-like.vercel.app)**. No sign-up: the
first visit creates a private guest board with sample tasks, teammates and labels.

## At a glance

|                |                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **What it is** | A full-featured task board: drag-and-drop, assignees, labels, due dates, search and filters, comments, activity log, multi-tab live sync |
| **Frontend**   | React 19, TypeScript (strict), Tailwind CSS v4 design tokens, Radix UI, dnd-kit, TanStack Query                                          |
| **Backend**    | Supabase: Postgres with RLS, anonymous Auth, triggers, Realtime. No custom server                                                        |
| **Quality**    | 250+ unit/component tests, automated accessibility (axe) and data-isolation checks, all run in CI on every pull request                  |
| **Hosting**    | Vercel (frontend) + Supabase free tier                                                                                                   |

### Try it in a minute

1. Open the [live demo](https://kanban-like.vercel.app). A sample board loads.
2. **Drag** a card to another column (or focus it and press `Space`, arrow keys, `Space`).
   Reload: it stays put.
3. **Click** a card to open the detail sheet. Change its status, assign a teammate, add a label
   and leave a comment, then watch each change appear in the activity timeline.
4. Press `/` and type to **search**, or filter by priority, assignee or label. The filters live
   in the URL, so you can share or bookmark the view.
5. Open the board in a **second tab** and make a change: the other tab updates in about a second.
6. **Delete** a card and hit **Undo** in the toast.

### Engineering highlights

- **Instant, safe UI.** Every write is optimistic: the board updates immediately, and on failure
  only the affected item rolls back, with a Retry toast. Assignee, label and comment writes are
  serialized, so quick toggles can't reach the server out of order.
- **Security in the database, not the client.** Owner-only RLS on every table, `user_id` set by
  the database, and composite foreign keys so a row can never link to another user's data, even
  with a guessed id. The activity log is written only by database triggers, so it can't be
  forged. A script signs in two real guests and proves the isolation, and CI runs it on every
  schema change.
- **Cheap reordering.** Fractional positions mean a drag-and-drop writes exactly one row.
- **Accessible by default.** Keyboard and touch drag-and-drop, screen-reader announcements,
  visible focus, and WCAG AA contrast. Palette colors are darkened automatically when they'd fail
  contrast. axe runs in CI against the board, dialogs and mobile layout.
- **Designed, not defaulted.** A small token-based design system (color, type scale, elevation,
  motion) with deliberate loading, empty, error, offline and "no results" states, responsive
  down to 360 px.

### How it was built

The project started from written requirements, a design doc and a phased implementation plan
(all in [`docs/`](docs)). Each phase landed as its own pull request, gated by CI (types, lint,
tests, accessibility, CodeQL, secret scanning, database checks) and verified in a real browser
against the live database. [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) records
the phases, decisions and deviations; [`docs/DESIGN.md`](docs/DESIGN.md) has the schema, security
model and design system.

## Features

### Core

- Four columns (To Do, In Progress, In Review, Done) with live task counts.
- Drag and drop with **mouse, touch (long-press) and keyboard** (Space to pick up, arrows to
  move), including **reordering within a column**. Order persists across reloads.
- **Optimistic updates** for every write: the card moves at once; on failure it snaps back and
  a toast offers Retry.
- Per-column **quick-add** (Enter saves, Esc cancels), plus a **"New task" dialog** with all
  fields (title, description, priority, due date).
- **Task detail sheet** (`?task=<id>`, deep-linkable) to edit every field; closes with Esc.
- **Delete with Undo**: the card disappears and a 5 s toast offers Undo before the delete is
  sent.
- **States**: skeleton loading, error with Retry, empty columns, first-run board, offline
  banner.
- Keyboard shortcuts: `C` quick-add, `/` focus search, `Esc` close/clear, `Enter` open card.

### Feature checklist

| Feature                    | Built | Notes                                                                         |
| -------------------------- | :---: | ----------------------------------------------------------------------------- |
| Due-date indicators        |  Yes  | Overdue (red), due within 2 days (amber), later (neutral); Done never overdue |
| Board summary / stats      |  Yes  | Total, completed (with %), overdue; updates live                              |
| Search and filtering       |  Yes  | Title search plus priority, assignee and label filters, all in the URL        |
| Team members and assignees |  Yes  | Add, edit and remove members (name, color, avatar URL); avatar stack          |
| Labels / tags              |  Yes  | Create, rename, recolor and delete labels; chips on cards; label filter       |
| Activity log               |  Yes  | Written by database triggers; one timeline with comments in the detail sheet  |
| Comments                   |  Yes  | In the same oldest-first feed; ⌘/Ctrl+Enter to send; count shown on cards     |

Also: **Realtime multi-tab sync**. Other tabs of the same guest refetch when tasks, assignees,
labels or comments change.

Out of scope by choice: dark mode, real multi-user accounts, custom columns.

## Tech stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 with CSS-variable design tokens ·
Radix UI primitives · dnd-kit · TanStack Query · Sonner · date-fns · Supabase (Postgres,
anonymous Auth, Realtime) · Vitest + Testing Library · Playwright + axe · oxlint + Prettier ·
Vercel hosting.

## Architecture

```
React SPA (Vercel)  ── supabase-js, publishable key + guest JWT ──▶  Supabase
  TanStack Query cache                                               Auth (anonymous)
  optimistic writes, URL state                                       Postgres + RLS
  Realtime subscription  ◀── postgres_changes (RLS-filtered) ──      triggers (seed, activity)
```

- **No custom backend.** The SPA talks to Supabase directly. RLS decides which rows a request can
  touch, so a middle tier would add latency and hosting without adding security.
- **The database is the source of truth.** Ownership (`user_id default auth.uid()`),
  `updated_at`, per-user sample data and the activity log live in Postgres defaults, constraints
  and triggers, not in client code.
- **UI state that opens things lives in the URL** (`?task=`, `?new=`, `?q=`, `?priority=`,
  `?assignee=`, `?label=`), so deep links and the back button work.

## Local setup

Requires a recent Node LTS (CI uses Node 26) and a free Supabase project.

1. **Clone and install**

   ```sh
   git clone https://github.com/jordanjust34/kanban-like.git
   cd kanban-like
   npm ci
   ```

2. **Create a Supabase project** and enable guest sign-in: _Authentication → Sign In /
   Providers → Allow anonymous sign-ins = ON_.

3. **Environment.** Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Use the **publishable** key, never
   the secret / service-role key. `SUPABASE_DB_PASSWORD` is only read by the Supabase CLI.

4. **Apply the schema**, either with the CLI:

   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   or by running each file in `supabase/migrations/` in filename order in the Supabase SQL
   editor. (`supabase/schema.sql` is a read-only concatenation of the migrations, for reading.)

5. **Run**

   ```sh
   npm run dev
   ```

   Open the printed URL; a guest session and sample board are created on first load.

### Scripts

| Script                 | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Vite dev server                                                |
| `npm run build`        | Typecheck and production build                                 |
| `npm test`             | Unit and component tests (Vitest, no network)                  |
| `npm run test:a11y`    | Playwright + axe accessibility checks against a mocked backend |
| `npm run rls-check`    | Two-guest isolation test against the project in `.env.local`   |
| `npm run typecheck`    | `tsc -b`                                                       |
| `npm run lint`         | oxlint                                                         |
| `npm run format:check` | Prettier check                                                 |

## Security

- **RLS on every table** (`tasks`, `team_members`, `task_assignees`, `labels`, `task_labels`,
  `comments`, `task_activity`). Each has an owner-only policy for the `authenticated` role:
  `(select auth.uid()) = user_id`. `user_id` defaults to `auth.uid()`; it is never trusted from
  the client. Table grants go to `authenticated` only; `anon` gets nothing.
- **Composite foreign keys** (`(task_id, user_id) → tasks(id, user_id)`, and the same for
  members and labels) make it impossible to link your rows to another user's rows, even with a
  guessed id.
- **Trigger-only activity log.** `task_activity` is read-only to clients; rows are written only
  by `SECURITY DEFINER` triggers (pinned `search_path`, `execute` revoked from API roles), so
  history can't be skipped or forged.
- **Publishable key only** in the frontend. No service-role key is used anywhere. `.env*` files
  (except `.env.example`) are git-ignored and CI fails if one is tracked.
- **Automated isolation check.** `npm run rls-check` signs in two fresh anonymous guests and
  verifies that B cannot read, update, delete, forge or link to A's rows, and that A's data is
  unchanged. The CI database job runs it against a local Supabase stack on every schema change.

## Quality and CI

| GitHub check                             | Guards                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CI: typecheck, lint, format, test, build | No tracked `.env`/PDF files, strict types, oxlint (warnings fail), Prettier, Vitest, build                             |
| Database: types in sync, lint, RLS       | Migrations apply on a fresh local Supabase; generated types match `database.types.ts`; `supabase db lint`; `rls-check` |
| Accessibility (axe)                      | Board (desktop and mobile), loading, error, offline, dialog and sheet have no axe violations; focus ring visible       |
| Security: dependency review, Gitleaks    | No new high-severity dependencies; no secrets in history                                                               |
| CodeQL                                   | Static security analysis of the TypeScript (security-extended queries)                                                 |

Dependabot keeps npm packages and GitHub Actions up to date.

## Project structure

```
src/
  app/            App shell, header, guest session bootstrap, providers, offline banner
  components/ui/  Design-system primitives (Button, Dialog, Sheet, Popover, Select, ...)
  features/
    board/        Columns, cards, drag and drop (dnd-kit sensors, announcements)
    tasks/        Task API (optimistic, undo delete), positions, quick-add, dialog, detail sheet
    due/          Due-date urgency rules and badge
    stats/        Board summary
    filters/      Search, filter bar, URL filter state, filter-group registry
    members/      Team members, assignees, avatar stack, assignee filter
    labels/       Labels, picker, chips, label filter
    activity/     Activity timeline, comments, comment count
    realtime/     Multi-tab sync via Supabase Realtime
  lib/            Supabase client, generated DB types, domain constants, query keys, URL state
supabase/migrations/  Schema, RLS, grants, triggers (source of truth)
scripts/rls-check.ts  Automated two-user isolation test
e2e/                  Playwright + axe accessibility suite
```

## Tradeoffs and what I'd do next

- **No backend.** Faster to ship and RLS covers security. A server would matter for rate
  limiting, webhooks or heavy aggregation.
- **Anonymous guests only.** Clearing browser storage loses the board. Next: "Save your board"
  that links an email to the anonymous user. Abuse relies on Supabase's default IP rate limit;
  next would be a CAPTCHA (Turnstile) and a job that purges stale guests.
- **Sample due dates use US Central time.** The seed trigger computes "today" in
  America/Chicago, so a guest far from US time may see the sample "due today" task off by a day.
  (User-entered dates are plain calendar dates and are not affected.)
- **Client-side filtering and stats.** Right for one guest's board (tens to hundreds of tasks).
  At scale: server-side queries and a stats view or RPC.
- **Team members aren't real users.** They are names with colors and avatars owned by one guest.
  Real collaboration needs workspaces, invites and membership-based RLS.
- **Fractional `position`.** One-row writes per move, with occasional column renumbering; a
  LexoRank-style string key would avoid float precision limits.
- **Fixed columns.** Status is text with a CHECK constraint; user-defined columns would need a
  `columns` table.
- **Activity payloads are minimal** (changed field names, not full diffs).
