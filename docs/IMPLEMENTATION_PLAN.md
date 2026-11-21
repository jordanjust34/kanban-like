# Implementation Plan — Kanban Task Board

Companion to [REQUIREMENTS.md](./REQUIREMENTS.md) and [DESIGN.md](./DESIGN.md). DESIGN §11 (decisions D1–D15) wins any conflict, except for the deviations listed in §1.

How the work runs: the **main session** (orchestrator) creates the shared contracts, starts subagents, merges their work and runs the checks. **Subagents** each own a fixed set of files and never edit files outside that set. Parallel agents run in isolated git worktrees. Steps marked **USER** need the user's accounts.

```
U1–U3 (user: Supabase)  ─────────────┐
P0  contracts (main) ─┬─ P1a scaffold ─┼─ gate ─ P2 core board ─ gate ─┬─ P3a due+stats ─┐
                      └─ P1b schema  ──┘   (apply SQL,                  ├─ P3a filters    ├─ gate ─┬─ P3b members ─┐
                                            gen types, U4 deploy)       └─ P3a task sheet ┘        └─ P3b labels  ─┴─ gate ─ P4 (stretch) ─ P5 polish/QA/docs
```

---

## 1. Changes from the handoff plan and DESIGN

| # | Change | Why |
|---|---|---|
| X1 | **All core schema is written in Phase 1b**: `0001_init.sql` (tasks), `0002_members.sql`, `0003_labels.sql`. Activity and comments (`0004`) wait until Phase 4 | Then `database.types.ts` is generated **once** before any feature work. Members and labels agents only write frontend code, so there is no type-file conflict and nobody regenerates types in the middle of a phase. Separate files still keep each feature's SQL easy to read |
| X2 | Assignee and label links are fetched as **their own queries** (`['task_assignees']`, `['task_labels']`), not embedded in the tasks query as DESIGN §5.2 says | The members and labels agents can't both edit `tasks/api.ts`. That's 3 small requests instead of 1, which is fine for one guest's board. Update DESIGN §5.2 |
| X3 | Extension points are **stub files**, not a runtime registry (see §3) | Simpler, fully type-checked, and gives each file exactly one owner |
| X4 | UI state that opens things lives in the **URL**: `?task=<id>` (detail sheet), `?new=<status>` (create dialog), plus the filter params | The board, the sheet and the dialog can be built by different agents without a shared store. Deep links and the back button work for free |
| X5 | React 19 / Tailwind v4 (whatever current `create vite` and Tailwind give), not React 18 | Current versions. dnd-kit and Radix support both. Update the DESIGN tech table |
| X6 | Added `src/features/due/` (badge + `getDueUrgency`) | DESIGN §5.1 has no home for it |
| X7 | Added `scripts/rls-check.ts`: signs in two anonymous users against the live project and checks isolation automatically | Turns the manual §4.4 test into one command. The two-browser manual run is still done in P5 |

---

## 2. Steps only the user can do

| ID | When | Step |
|---|---|---|
| U1 | Before the P1 gate | Create a Supabase project (free tier). Authentication → Sign In / Providers → **Allow anonymous sign-ins = ON** |
| U2 | Before the P1 gate | Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key; **never** the secret/service-role key) — **done**, values saved |
| U3 | Before the P1 gate | **Either** run `npx supabase login` and give the project ref + DB password (so the main session can run `db push` and `gen types`), **or** paste each migration into the SQL editor yourself and run `gen types` with a token later. Without types, P1a's hand-written types are used until then |
| U4 | After P2 (Musts done) | Import the GitHub repo in the Vercel dashboard, set the two env vars, deploy. Needs the code on GitHub, so it depends on the git decision (§8) |
| U5 | P5 | Two-browser isolation test (DESIGN §4.4), a check on a real phone, final PDF upload and form submission |

The main session can generate a guided script for U1–U4 with the `wizard` skill if wanted.

---

## 3. Phase 0: shared contracts (main session, before any agent starts)

Small and written by hand, so every later agent builds on the same base. These files are **frozen**: agents may read them, and only the main session changes them.

- `src/lib/domain.ts`: `Status`, `STATUSES` (ordered, with label and accent), `Priority`, `PRIORITIES`.
- `src/lib/urlState.ts`: typed helpers for reading and writing search params (`useSearchParam`, `setSearchParams`, keys `q`, `priority`, `assignee`, `label`, `task`, `new`). No router, just `URLSearchParams` + `history.replaceState`/`pushState` and a `popstate` listener.
- `src/lib/queryKeys.ts`: `tasks`, `members`, `labels`, `taskAssignees`, `taskLabels`, `activity(taskId)`, `comments(taskId)`.
- `src/features/filters/types.ts`:
  ```ts
  export type FilterOption = { id: string; label: string; color?: string };
  export type FilterGroup = {
    key: 'priority' | 'assignee' | 'label';           // = URL param name
    label: string;
    /** Hook: called in fixed order on every render of the filter bar / board. */
    useGroup(): { options: FilterOption[]; matches(task: Task, selected: string[]): boolean };
  };
  ```

**Slot rule.** A slot is a component file whose **signature is fixed** and whose body starts as `return null` (or the pass-through default). The **consumer's author** creates the stub. The **feature owner** later replaces only the body. Nobody else touches it.

| Slot file | Signature | Stub created in | Filled in |
|---|---|---|---|
| `features/due/DueBadge.tsx` | `({ task }: { task: Task })` | P1a | P3a due+stats |
| `features/labels/CardLabels.tsx` | `({ task }: { task: Task })` | P1a | P3b labels |
| `features/members/CardAssignees.tsx` | `({ task }: { task: Task })` | P1a | P3b members |
| `features/activity/CardCommentCount.tsx` | `({ task }: { task: Task })` | P1a | P4 |
| `features/stats/BoardStats.tsx` | `()` | P1a | P3a due+stats |
| `features/members/HeaderMembers.tsx` | `()` | P1a | P3b members |
| `features/filters/FilterBar.tsx` | `()` | P1a | P3a filters |
| `features/filters/useVisibleTasks.ts` | `(tasks: Task[]) => { visible: Task[]; isFiltering: boolean }` (stub: pass-through) | P1a | P3a filters |
| `features/tasks/TaskSheetHost.tsx` | `()` (mounted once in `App`) | P1a | P3a task sheet |
| `features/members/filter.ts` | `export const assigneeFilterGroup: FilterGroup \| null = null` | P3a filters | P3b members |
| `features/labels/filter.ts` | `export const labelFilterGroup: FilterGroup \| null = null` | P3a filters | P3b labels |
| `features/members/AssigneeField.tsx` | `({ task }: { task: Task })` | P3a task sheet | P3b members |
| `features/labels/LabelField.tsx` | `({ task }: { task: Task })` | P3a task sheet | P3b labels |
| `features/activity/TaskFeed.tsx` | `({ taskId }: { taskId: string })` | P3a task sheet | P4 |

Also written in P0 (as built):
- `src/lib/database.types.ts`: **hand-written** placeholder in the generated format (tasks, team_members, task_assignees, labels, task_labels). Replaced by `supabase gen types` at the P1 gate and never edited by hand after that.
- `src/features/tasks/types.ts`: `Task` = `Tables<'tasks'>` with `status`/`priority` narrowed to `Status`/`Priority`, plus `TaskInsert`/`TaskUpdate` (owned by P2 after P0).
- All `src/` imports use the **`@/` alias** (= `src/`). P1a configures it in `tsconfig` + Vite + Vitest.

---

## 4. Phases and agent briefs

Each brief below is the **scope**. The actual prompt adds: "Read `docs/DESIGN.md`, `docs/REQUIREMENTS.md` and this plan. Only edit the files you own. Run `npm run typecheck && npm run lint && npm test` before finishing. Report what you built, what you skipped, and any contract you think needs to change. Don't change frozen files yourself."

### Phase 1 (2 agents in parallel)

**P1a: Scaffold** (owns everything under `src/` except the frozen P0 files, plus root config)
- Vite + React + TS strict; Tailwind v4 with DESIGN §6 tokens as CSS variables in `src/styles/tokens.css` (`[data-theme]`-ready, D14); Inter via `@fontsource-variable/inter`.
- ESLint (typescript-eslint, react-hooks), Prettier, Vitest + jsdom + Testing Library. Scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `test`.
- Install the agreed deps now, so later agents don't edit `package.json`: `@supabase/supabase-js @tanstack/react-query @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @radix-ui/react-{dialog,popover,dropdown-menu,tooltip,tabs} lucide-react sonner date-fns clsx`.
- `src/lib/supabase.ts` (typed `createClient<Database>` from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; throws a clear error if they're missing). `database.types.ts` already exists from P0.
- `src/app/auth.ts`: `ensureSession()` as a **module-level singleton promise** (`getSession` → `signInAnonymously`); `useSession()` hook. Unit test: two calls start only one sign-in.
- Providers (QueryClient with sensible retry, Sonner `Toaster`), `App.tsx` shell: header (board name D15, `BoardStats` slot, `HeaderMembers` slot, "New task" button → `?new=todo`), toolbar (`FilterBar` slot), board area, `TaskSheetHost` slot, offline banner (`navigator.onLine`).
- `components/ui/`: Button, Input, Textarea, Select, Badge, Skeleton, EmptyState, ErrorState, Kbd, Spinner. Styled from tokens; focus rings.
- Creates all P1a slot stubs from §3. Makes the P0 files compile (alias `@/`) without changing them.
- `.env.example`. **Done when:** `npm run build` passes and the shell renders with a placeholder board area.

**P1b: Schema** (owns `supabase/**`, `scripts/rls-check.ts`)
- `npx supabase init` (config only). Migrations, using DESIGN §3.4 and §4.2 SQL:
  - `0001_init.sql`: `set_updated_at`, `tasks`, index, trigger, RLS + `owner_all`; `public.seed_tasks()` (`SECURITY DEFINER`, `set search_path = ''`) + trigger **`seed_10_tasks`** `after insert on auth.users`. 8 tasks per the D9 spec, `user_id = new.id`, due dates relative to `current_date`, positions 1000, 2000, …
  - `0002_members.sql`: `team_members`, `task_assignees` (composite FKs), RLS; trigger **`seed_20_members`**: 3 members + a few assignments (finds the seeded tasks by `user_id` + title).
  - `0003_labels.sql`: `labels`, `task_labels`, RLS; trigger **`seed_30_labels`**: Bug/Feature/Design/Chore + a few links.
  - Explicit `grant`s are not needed (Supabase defaults), but say so in a comment.
- `supabase/seed.sql` is **not** used (seeding is per user, via the triggers).
- `scripts/rls-check.ts` (run with `npx tsx`, reads `.env.local`): user A and user B each sign in anonymously; A sees its 8 seeded tasks; B can't select, update or delete A's task by id (0 rows); B can't insert a `task_assignees` row that points at A's task (FK error).
- **Done when:** the SQL is complete and reviewed. It can't be run until U1–U3 are done.

**P1 gate (main):** merge both → apply migrations (`npx supabase db push`, or the user pastes them) → `npx supabase gen types typescript --project-id … > src/lib/database.types.ts` → typecheck → `npm run dev` in a fresh incognito window: session is created and the board area shows → `npx tsx scripts/rls-check.ts` passes.

### Phase 2 (1 agent): core board, all Musts

**P2: Board** (owns `features/board/**`, `features/tasks/{api.ts,types.ts,position.ts,QuickAdd.tsx}` and their tests)
- `position.ts`: `positionBetween(prev?, next?)` and `needsRenumber`, **test-first** (`tdd` skill). Renumber the column in one batch when the gap is < 1e-9.
- `api.ts`: `useTasks()` (ordered by position; enabled only after the session resolves), `useCreateTask`, `useUpdateTask`, `useMoveTask`, `useDeleteTask`. All optimistic: snapshot → apply → rollback + toast with **Retry** → invalidate.
- **Delete (D12):** remove optimistically, show a 5 s **Undo** toast, send the DELETE when the toast closes. Keep a `pendingDeletes` set and filter it out of `useTasks`'s `select`, so a refetch during the 5 s doesn't bring the card back. On `pagehide`, send any pending deletes right away.
- Board: `DndContext` (pointer 4 px, touch 200 ms, keyboard sensors), a `SortableContext` per column, droppable empty columns, `DragOverlay` (scale 1.02, 2° tilt), dashed placeholder, column tint on hover, live reflow in `onDragOver`, **one** persist in `onDragEnd`. Cancel task queries when a drag starts, so a refetch can't fight the drag. Screen-reader announcements.
- Column header (dot, name, count, `+`), per-column `QuickAdd` (Enter saves, Esc cancels, rejects whitespace-only titles inline), `TaskCard` (layout from DESIGN §7.2 with the slot components, priority icon + text, hover "⋯" menu: move to…, delete). Card click / Enter → `?task=<id>`.
- States: skeleton columns, `ErrorState` + Retry, empty column ("No tasks" / "Drop here"), first-run empty board.
- Board reads tasks through `useVisibleTasks(tasks)` (still the pass-through stub).
- Responsive layout from DESIGN §7.7 (scroll-snap columns on mobile).
- **Done when:** FR-B1–B5, FR-T1, FR-T4, FR-S1–S4 can be shown in the browser.

**P2 gate (main):** code review of the diff (`code-review` skill) → `run` skill: drag across columns, reload, check that order persists, kill the network and check rollback → **U4 deploy** → check the live URL.

### Phase 3a (3 agents in parallel)

**P3a-1: Due dates + stats** (owns `features/due/**`, `features/stats/**`)
- `getDueUrgency(dueDate, status, today)` → `{ tone: 'danger' | 'warning' | 'neutral' | 'done'; text }` exactly as in DESIGN §7.3, **test-first**. Use local dates (watch out for UTC: parse `YYYY-MM-DD` as a local date).
- `DueBadge` (icon + text, not color alone). `deriveStats(tasks, today)` + tests. `BoardStats` pills with % done, a thin progress bar, and overdue shown red only when > 0.

**P3a-2: Search & filters** (owns `features/filters/**`, plus creates the `members/filter.ts` and `labels/filter.ts` stubs)
- `matchesFilters(task, q, groups, selected)` with tests: title contains `q` (case-insensitive), AND across groups, OR within a group.
- `registry.ts`: `[priorityFilterGroup, assigneeFilterGroup, labelFilterGroup].filter(Boolean)`. The array is fixed, so calling hooks over it is safe.
- `FilterBar`: search box (`/` to focus, Esc clears), one popover multi-select per group, active-filter chips, "Clear filters". On mobile it collapses into a single filter button.
- Replace the body of `useVisibleTasks`. Export a `NoResults` state that the board shows when `isFiltering && visible.length === 0`. **Note:** the board needs a 2-line change to render it. The main session makes that change at the gate, so the agent doesn't edit `features/board/**`.

**P3a-3: Create dialog + task detail sheet** (owns `features/tasks/{TaskSheetHost,TaskDetailSheet,TaskForm,CreateTaskDialog}.tsx`, plus creates the `AssigneeField`, `LabelField` and `TaskFeed` stubs)
- `TaskSheetHost` reads `?new` → create dialog (all fields, D13; status preset from the param), and `?task` → detail sheet. Clears the param on close.
- Detail sheet: Radix Dialog as a right sheet (480 px; full-screen < 640 px). Inline title, property grid (status, priority, due date, `AssigneeField`, `LabelField`), description autosaves on blur, "Saving…" indicator, delete, `TaskFeed` slot. If `?task` points to a missing id, show a not-found state.
- Uses P2's mutations only and doesn't change `api.ts`. If it needs a new mutation, it reports that instead.
- Global `C` shortcut → `?new=todo` (registered here, ignored while typing in an input).

**P3a gate (main):** merge → add the `NoResults` hook-up to the board → typecheck, lint, test, build → review → browser check.

### Phase 3b (2 agents in parallel)

**P3b-1: Members & assignees** (owns `features/members/**`)
- `api.ts`: members CRUD, `useTaskAssignees()` (all links in one query → `Map<taskId, memberId[]>`), add/remove assignee (optimistic).
- `Avatar`, `AvatarStack` (max 3 + "+N"), `CardAssignees`, `HeaderMembers` (avatar stack + popover to add, edit or remove members: name, 8-swatch color, optional avatar URL), `AssigneeField` (multi-select popover), `assigneeFilterGroup`.

**P3b-2: Labels** (owns `features/labels/**`)
- `api.ts`: labels CRUD (handle the unique-name error nicely), `useTaskLabels()` map, add/remove label (optimistic).
- `LabelChip` (12 % tint background + full-strength text), `CardLabels` (max 3 + "+N"), `LabelField` (picker with "Create label" inline), a place to manage labels (inside the picker: rename, recolor, delete), `labelFilterGroup`.

**P3b gate (main):** merge → test in a fresh incognito window (seed now includes members and labels) → `rls-check` → review → redeploy. **The "Should" scope is done here.**

### Phase 4 (stretch, in this order; stop when the time budget is used up)

**P4-1: Activity + comments** (owns `supabase/migrations/0004_activity_comments.sql`, `features/activity/**`)
- SQL from DESIGN §3.4: `comments`, `task_activity`, `log_task_activity`, plus assignee/label logging triggers. **Gotcha:** when a task is deleted, the cascade deletes its `task_assignees`/`task_labels` rows, and their `after delete` logging trigger would insert activity for a task that no longer exists. That fails the FK check and **blocks the delete**. Skip logging when the parent task no longer exists.
- Activity: read-only RLS. `TaskFeed`: comments and activity merged in time order ("Moved from To Do → In Progress · 2 hours ago"), composer with ⌘/Ctrl+Enter. `CardCommentCount`.
- The main session applies the migration and regenerates types **before** starting the agent (same pattern as X1).

**P4-2: Realtime** (main session, small): `postgres_changes` on `tasks` filtered by `user_id` → invalidate (skip during a drag). Enable replication for `tasks` in the dashboard (**USER**, 1 click).

**P4-3: Dark mode** (main session, small): `[data-theme="dark"]` token overrides + a toggle. Only if time is left.

### Phase 5: polish, QA, deliverables

- **P5-1 (agent): polish/accessibility pass** across the whole UI: motion timings, focus rings, contrast (WCAG AA), labels on controls, layout at 360 / 768 / 1280 px, keyboard drag. Reports problems and fixes small ones; anything bigger comes back to the main session.
- **Main:** `security-review` skill (RLS, key exposure, `.env` handling); README (setup from DESIGN §8, live URL, features, screenshots); update DESIGN for X1–X7.
- **USER (U5):** two-browser isolation test, check on a real phone.
- **Final doc draft** (`docs/submission.md` → PDF, REQUIREMENTS §6.2 checklist). The SQL appendix is the concatenated migrations. **Git-ignore the PDF if it contains anything from the brief.**

---

## 5. Checks every gate runs

1. `npm run typecheck && npm run lint && npm test && npm run build`
2. Fresh incognito window: sign-up works (the seed trigger didn't break it), the seeded board appears.
3. Reload: same user, same data.
4. `npx tsx scripts/rls-check.ts` (from P1 on).
5. Code review of the merged diff before the next phase starts.

## 6. Gotchas (repeated in the briefs that need them)

- `auth.uid()` is **null** inside the `auth.users` seed triggers. Always insert `user_id = new.id`. An error in any seed trigger **blocks sign-up**.
- Seed triggers run in name order (`seed_10_…`, `seed_20_…`, `seed_30_…`), so members and labels can attach to tasks seeded earlier.
- `due_date` is a `date`. `new Date('2026-11-20')` is UTC midnight and shows the wrong day west of UTC. Use `date-fns` `parseISO` and compare local calendar dates.
- React StrictMode runs effects twice in dev. That's why the session bootstrap is a module singleton, not an effect.
- Optimistic drag + background refetch: cancel queries when a drag starts, and invalidate only in `onSettled`.
- Undo-delete: filter `pendingDeletes` out of query results, or a refetch brings the card back.
- `SECURITY DEFINER` functions: always `set search_path = ''` and fully qualified names.
- Never put the service-role key anywhere, including `scripts/`.

## 7. Agent count and cost

7 subagents (2 + 1 + 3 + 2), plus up to 2 in phases 4–5. They run at most 3 at a time, using the Agent tool with `isolation: "worktree"`. This is not a multi-agent Workflow (that needs an explicit opt-in).

## 8. Decisions (2026-11-20)

1. **Git workflow: feature branches + PRs.**
   - PR #0 `docs/plan`: `.gitignore`, REQUIREMENTS, DESIGN, this plan. It gets merged first so worktrees can see the docs.
   - Then one branch per phase (`phase-0-contracts`, `phase-1-foundation`, `phase-2-board`, `phase-3a-…`, `phase-3b-…`, …). The main session commits the phase branch, and parallel agents work in worktrees that branch from it. The main session merges their work back into the phase branch, runs the gate checks, pushes, and opens a PR (`pr` skill).
   - **The user reviews and merges each PR into `main`.** The next phase branches from the updated `main`. Vercel (U4) is connected to `main` and makes preview deploys per PR.
   - If phases overlap, the next phase can branch from the unmerged phase branch. Otherwise the main session waits for the merge.
2. **Migrations: the main session applies them.** The user runs `! npx supabase login` and shares the project ref + DB password. The main session runs `npx supabase link`, `db push` and `gen types` at each gate.
