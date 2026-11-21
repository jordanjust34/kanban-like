# Kanban Task Board

A polished, Linear-style Kanban board: drag tasks between four columns, with instant optimistic
updates, guest accounts and Postgres Row Level Security as the only security boundary.

- **Live demo:** https://kanban-like.vercel.app
- **Final document (draft):** [docs/submission.md](docs/submission.md)
- **Design and plan:** [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) ·
  [docs/DESIGN.md](docs/DESIGN.md) · [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

No sign-up: the first visit creates an anonymous guest session, seeded with sample tasks,
members and labels, so every feature is visible right away.

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

### Advanced features from the brief

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

Dark mode was considered and deliberately dropped (light theme only).

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
