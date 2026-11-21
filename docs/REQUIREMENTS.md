# Task Board Assessment Challenge

## Goal
Build a beautiful, fully-featured Kanban-style task board where users can create tasks, drag them across board sections, and manage work visually — inspired by tools like Asana and Linear.

## Time
3-6 hours (max 12, unfamilliar tech stack)

## Cost
Free tier only.

---
# Requirements
## The Board (Required)
Build a Kanban-style drag-and-drop board with the following default columns:
- To Do
- In Progress
- In Review
- Done

Internship Assessment — Software Development — Confidential document — do not share or post on the internet
Users must be able to drag tasks between columns to update their status. The board should update in
real time (or on drop).

---
## Database (Supabase)
Create a tasks table with the following fields:
Field Type Notes
id uuid primary key
title text required
status text todo, in_progress, in_review, done
user_id uuid tied to guest session
created_at timestamp auto-set
Bonus fields (recommended):
- description (text)
- priority (low / normal / high)
- due_date (date)
- assignee_id (uuid, references a team member)
Tasks must persist in Supabase with RLS enabled.

## Guest Accounts (Required)
Your app must support guest accounts so each user only sees their own tasks.
• Use Supabase Auth anonymous sign-in (no email/password required)
• Create a guest session automatically on first app launch
• Store each task with a user_id tied to the guest user
• Enable Row Level Security (RLS) so users can only read/write their own data
Expected behavior:
• User A creates tasks and only sees User A's tasks
• User B creates tasks and only sees User B's tasks

## Frontend (Required)
Build a web frontend or React Native app.
Your app must allow users to:
• View their task board with columns
• Create a new task (with a title, and optionally description, priority, due date)
• Drag tasks between columns to update their status
• See loading and error states clearly

Internship Assessment — Software Development — Confidential document — do not share or post on the internet

### Advanced Features — Highly Recommended if You Want to Stand Out
These features are optional but strongly encouraged. They will meaningfully differentiate your
submission. Pick any combination:
1. Team Members & Assignees
• Allow the user to create a small "team" by adding members (name + optional avatar/color)
• Show team members in the board UI
• Let users assign one or more team members to a task
• Display assignee avatars on task cards
2. Task Comments
- Let users open a task detail panel and write comments
- Show comments in chronological order with a timestamp
- Store comments in a separate comments table in Supabase
3. ��������Task Activity Log
• Track the history of changes to a task (status changes, edits, assignments)
• Show a timeline of activity inside the task detail view
• Example: "Moved from To Do → In Progress · 2 hours ago"
4. ����Labels / Tags
• Let users create custom labels (e.g. "Bug", "Feature", "Design")
• Assign multiple labels to a task
• Filter the board by label
5. ������������Due Date Indicators
• Highlight tasks that are due soon or overdue directly on the card
• Show a visual indicator (e.g. colored badge, icon) based on urgency
6. ���Search & Filtering
• Add a search bar to filter tasks by title
• Add filters for priority, assignee, or label
7. �����Board Summary / Stats
• Show a small summary: total tasks, tasks completed, tasks overdue
• Could live in a sidebar or header area

����Backend (Optional)
You may either:
• Call Supabase directly from the frontend, or

Internship Assessment — Software Development — Confidential document — do not share or post on the internet
• Build a small API (Go optional) with endpoints to get tasks, create tasks, and update tasks

�Hosting (Required)
Host your frontend so we can use a live demo. Free options:
• Vercel
• Netlify
• Cloudflare Pages
Include the live URL in your final document.

����Access & Sharing
GitHub: Make your repository public, or share it as a private repo and send us the link directly. You do
not need to add us as a collaborator.
Supabase: Share read-only access to your database schema by including the full SQL schema in your
final document. You may also share a screenshot of your table structure from the Supabase dashboard.
You do not need to add us as a project member.
���Do not share your Supabase service role key. Use only the public anon key in your frontend. Do not
commit secrets to GitHub.

���� Final Deliverable
Submit one .pdf or .docx file named: firstname_lastname_task_manager_assessment.pdf
Include:
• A short overview of your solution and design decisions
• A link to your live frontend app
• A link to your GitHub repository
• Your full database schema (SQL or clear description)
• Setup instructions to run locally
• Which advanced features you built (if any) and how they work
• Tradeoffs and what you'd improve with more time
