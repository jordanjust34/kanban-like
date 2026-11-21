# Requirements — Kanban Task Board

> Source: Next Play Games SDE internship assessment brief (kept locally in `docs/`, **not committed** — the brief is confidential).
> This doc restates the requirements in our own words and adds acceptance criteria and scope decisions.

## 1. Goal

Build a polished, Kanban-style task board where a user can create tasks, drag them between columns, and manage work visually. It should feel like Linear / Asana / Notion, not a generic todo list.

## 2. Constraints

| Constraint | Value |
|---|---|
| Time budget | 3–6 h target, 12 h hard cap |
| Cost | $0 — free tiers only (Supabase, Vercel, GitHub) |
| Required tech | Supabase (DB + Auth), GitHub |
| Chosen stack | React + TypeScript (web), Supabase called directly from the frontend. Go backend is optional and **not planned** (see DESIGN.md §9) |
| Secrets | Only the public anon key in the frontend. No service-role key anywhere. No secrets committed |

Priority key: **Must** = required by the brief · **Should** = advanced feature we plan to build · **Could** = build if time allows.

---

## 3. Functional requirements

### 3.1 Board — Must

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-B1 | Board shows four columns in order: **To Do**, **In Progress**, **In Review**, **Done** | Columns render even when empty; each shows a task count |
| FR-B2 | Tasks can be dragged between columns to change status | Dropping a card in a column sets `status` to that column's value |
| FR-B3 | Status change persists | Reloading the page after a drop shows the task in its new column |
| FR-B4 | Board updates immediately on drop | The card moves instantly (optimistic); if the save fails it snaps back and an error is shown |
| FR-B5 | *(Could)* Reorder within a column | Card order within a column persists across reloads |

### 3.2 Tasks — Must

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-T1 | Create a task with a required **title** | Empty or whitespace-only title is rejected with an inline message |
| FR-T2 | Optional fields when creating: **description**, **priority** (low / normal / high), **due date** | Priority defaults to `normal`; new tasks default to `todo` (or the column the user created it from) |
| FR-T3 | *(Should)* Open a task to view and edit all fields | Edits persist; the detail view can be closed with Esc |
| FR-T4 | *(Should)* Delete a task | Requires confirmation (or offers undo); the card is removed from the board |

### 3.3 Guest accounts & data isolation — Must

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-A1 | Use Supabase Auth **anonymous sign-in**; no email/password | No login screen exists |
| FR-A2 | Create a guest session automatically on first launch | First visit: a session is created before the board loads |
| FR-A3 | Reuse the session on return visits | Reloading the same browser shows the same tasks |
| FR-A4 | Every task is stored with `user_id` = the guest user's id | Set by the database default (`auth.uid()`), not trusted from the client |
| FR-A5 | **RLS** enabled on every table; users can only read/write their own rows | User A (browser 1) and User B (incognito) each see only their own tasks; a direct API call for another user's row returns nothing |

### 3.4 Frontend states — Must

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-S1 | Loading state while the session and tasks load | Skeleton columns/cards, not a blank screen |
| FR-S2 | Error state when loading fails | Clear message and a **Retry** action |
| FR-S3 | Error feedback when a mutation fails (create / move / edit) | Toast with the reason; optimistic change is rolled back |
| FR-S4 | Empty states | Each empty column has a friendly hint; a brand-new board has a first-run prompt to create a task |

### 3.5 Advanced features

The brief lists seven optional features. Plan, in build order:

| # | Feature | Priority | Requirements |
|---|---|---|---|
| 5 | **Due date indicators** | Should | Cards show a badge: *overdue* (red), *due today / within 48 h* (amber), *later* (neutral). Done tasks never show as overdue |
| 7 | **Board summary / stats** | Should | Header shows total tasks, completed, overdue. Updates live as tasks change |
| 6 | **Search & filtering** | Should | Search box filters by title (case-insensitive, as you type). Filters for priority, assignee, label. Active filters are visible and clearable |
| 1 | **Team members & assignees** | Should | Add / edit / remove members (name + color, optional avatar URL). One or more assignees per task. Avatar stack on cards. Members visible in the board UI |
| 4 | **Labels / tags** | Should | Create custom labels (name + color). Multiple labels per task. Labels shown as chips on cards. Filter board by label |
| 3 | **Activity log** | Could | Record status changes, field edits, assignment and label changes. Timeline in the detail view, e.g. *"Moved from To Do → In Progress · 2 hours ago"* |
| 2 | **Comments** | Could | Write comments in the task detail panel; shown oldest-first with timestamps; stored in a separate `comments` table |

All advanced-feature tables must also be protected by RLS (owner-only).

### 3.6 Hosting — Must

| ID | Requirement |
|---|---|
| FR-H1 | Frontend deployed to a free host (Vercel planned) with a public live URL |
| FR-H2 | Live app works end-to-end against the hosted Supabase project |

---

## 4. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-1 | **Design (top priority)** | Cohesive color palette and typography system; clear hierarchy between columns and cards; smooth drag-and-drop; polished empty/loading/error states. See DESIGN.md §6 |
| NFR-2 | Responsive | Usable on mobile (≥ 360 px wide) and desktop |
| NFR-3 | Security | RLS on every table; anon key only; `.env` git-ignored; `.env.example` committed |
| NFR-4 | Performance | Board interactive in < 2 s on a normal connection; drag at 60 fps |
| NFR-5 | Accessibility | Keyboard-operable drag-and-drop, visible focus rings, WCAG AA contrast, labelled controls |
| NFR-6 | Code quality | TypeScript strict mode, ESLint + Prettier, small focused modules, typed DB access |

---

## 5. Out of scope

- Email/password or OAuth sign-in, account upgrade from guest
- Real multi-user collaboration (team members are labels-with-avatars owned by one guest, not other logins)
- Custom / user-defined columns
- Go backend API
- Native mobile app

---

## 6. Deliverables

### 6.1 Repository
- GitHub repo, public (or private + link shared)
- README with local setup
- `supabase/` folder containing the full SQL schema / migrations

### 6.2 Final document
One file named `firstname_lastname_task_manager_assessment.pdf` (or `.docx`), uploaded to Google Drive and submitted via the Google Form. It must include:

- [ ] Short overview of the solution and design decisions
- [ ] Live frontend URL
- [ ] GitHub repo URL
- [ ] Full database schema (SQL), optionally a screenshot of the Supabase table editor
- [ ] Local setup instructions
- [ ] Advanced features built and how they work
- [ ] Tradeoffs and what we'd improve with more time

### 6.3 Confidentiality
- Don't upload or share the assessment PDF publicly (keep it out of git).
- Don't publicly post the submission link (LinkedIn, GitHub profile, personal site). Linking the working demo from a résumé is allowed.

---

## 7. Evaluation criteria (what reviewers grade)

| Criterion | Where we address it |
|---|---|
| Design quality — polished and intentional | NFR-1, DESIGN.md §6–7 |
| Board functionality — drag-and-drop, columns, task management | FR-B*, FR-T* |
| Frontend usability and state handling | FR-S*, DESIGN.md §5 |
| Database schema and persistence | DESIGN.md §3 |
| Security awareness — RLS, no exposed keys | FR-A5, NFR-3, DESIGN.md §4 |
| Advanced features | §3.5 |
| Code quality and structure | NFR-6, DESIGN.md §8 |
| Live app execution | FR-H* |
| Clarity of final document | §6.2 |
