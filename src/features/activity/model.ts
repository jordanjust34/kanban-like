/**
 * Pure helpers for the task feed (advanced #2 comments, #3 activity log): describing an activity
 * row in words, merging comments and activity into one chronological feed, and comment counts.
 */
import type { Json, Tables } from '@/lib/database.types';
import { isStatus, LIMITS, STATUS_BY_VALUE } from '@/lib/domain';

export type ActivityEntry = Tables<'task_activity'>;
export type Comment = Tables<'comments'>;
/** One row of the comment-count query (`select task_id from comments`). */
export type CommentCountRow = Pick<Comment, 'task_id'>;

/** A run of text; `strong` parts are names / values, `color` is an optional swatch for a dot. */
export type TextPart = { text: string; strong?: boolean; color?: string };

/** Current names, used only when an activity payload lacks its snapshot name. */
export type NameMaps = {
  members?: ReadonlyMap<string, string>;
  labels?: ReadonlyMap<string, string>;
};

type Payload = { [key: string]: Json | undefined };

function asObject(payload: Json | undefined): Payload {
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
}

function asString(value: Json | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function statusPart(value: Json | undefined): TextPart {
  const raw = asString(value) ?? 'unknown';
  if (!isStatus(raw)) return { text: raw, strong: true };
  const status = STATUS_BY_VALUE[raw];
  return { text: status.label, strong: true, color: status.accent };
}

const FIELD_NAMES: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  due_date: 'due date',
};

/** "a", "a and b", "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function refPart(
  payload: Payload,
  names: ReadonlyMap<string, string> | undefined,
  missing: string,
) {
  const id = asString(payload.id);
  const name = asString(payload.name) ?? (id ? names?.get(id) : undefined) ?? missing;
  const color = asString(payload.color);
  return color ? { text: name, strong: true, color } : { text: name, strong: true };
}

const FALLBACK: TextPart[] = [{ text: 'updated the task' }];

/**
 * Activity row in words, without the actor (always "You" on a single-user guest board). Uses the
 * payload's name snapshot, so renamed / deleted members and labels read as they were.
 */
export function describeActivity(entry: ActivityEntry, nameMaps: NameMaps = {}): TextPart[] {
  const payload = asObject(entry.payload);
  switch (entry.kind) {
    case 'created':
      return [{ text: 'created the task' }];
    case 'status_changed':
      return [
        { text: 'moved from ' },
        statusPart(payload.from),
        { text: ' → ' },
        statusPart(payload.to),
      ];
    case 'edited': {
      const fields = Array.isArray(payload.fields)
        ? payload.fields
            .filter((f): f is string => typeof f === 'string')
            .map((f) => FIELD_NAMES[f] ?? f.replaceAll('_', ' '))
        : [];
      if (fields.length === 0) return FALLBACK;
      const verb = fields.length === 1 ? 'changed' : 'updated';
      return [{ text: `${verb} the ${joinList(fields)}` }];
    }
    case 'assignee_added':
      return [{ text: 'assigned ' }, refPart(payload, nameMaps.members, 'a removed member')];
    case 'assignee_removed':
      return [{ text: 'unassigned ' }, refPart(payload, nameMaps.members, 'a removed member')];
    case 'label_added':
      return [{ text: 'added label ' }, refPart(payload, nameMaps.labels, 'a deleted label')];
    case 'label_removed':
      return [{ text: 'removed label ' }, refPart(payload, nameMaps.labels, 'a deleted label')];
    default:
      return FALLBACK;
  }
}

/* ─────────────────────────────────── feed ─────────────────────────────────── */

export type FeedItem =
  | { type: 'activity'; key: string; at: string; entries: ActivityEntry[] }
  | { type: 'comment'; key: string; at: string; comment: Comment };

/** Consecutive activity rows closer than this collapse into one group (one save, many changes). */
export const GROUP_WINDOW_MS = 60_000;

type Sortable =
  | { type: 'activity'; time: number; entry: ActivityEntry }
  | { type: 'comment'; time: number; comment: Comment };

function compare(a: Sortable, b: Sortable): number {
  if (a.time !== b.time) return a.time - b.time;
  // Same instant: activity first (a save that logs several rows shares one `now()`), then ids.
  if (a.type !== b.type) return a.type === 'activity' ? -1 : 1;
  if (a.type === 'activity' && b.type === 'activity') return a.entry.id - b.entry.id;
  return 0;
}

/** Comments and activity merged oldest first; nearby activity rows are grouped. */
export function buildFeed(
  activity: readonly ActivityEntry[],
  comments: readonly Comment[],
): FeedItem[] {
  const rows: Sortable[] = [
    ...activity.map((entry) => ({
      type: 'activity' as const,
      time: Date.parse(entry.created_at),
      entry,
    })),
    ...comments.map((comment) => ({
      type: 'comment' as const,
      time: Date.parse(comment.created_at),
      comment,
    })),
  ].toSorted(compare);

  const feed: FeedItem[] = [];
  let lastTime = 0;
  for (const row of rows) {
    if (row.type === 'comment') {
      feed.push({
        type: 'comment',
        key: `c-${row.comment.id}`,
        at: row.comment.created_at,
        comment: row.comment,
      });
      continue;
    }
    const previous = feed.at(-1);
    if (previous?.type === 'activity' && row.time - lastTime < GROUP_WINDOW_MS) {
      previous.entries.push(row.entry);
    } else {
      feed.push({
        type: 'activity',
        key: `a-${row.entry.id}`,
        at: row.entry.created_at,
        entries: [row.entry],
      });
    }
    lastTime = row.time;
  }
  return feed;
}

/* ─────────────────────────────── comment lists ─────────────────────────────── */

/** Normalised body, or `null` when it can't be sent (empty / whitespace-only / too long). */
export function commentBody(text: string): string | null {
  const body = text.trim();
  return body.length > 0 && body.length <= LIMITS.commentBody ? body : null;
}

export function addComment(list: readonly Comment[], comment: Comment): Comment[] {
  return [...list, comment];
}

export function replaceComment(list: readonly Comment[], id: string, next: Comment): Comment[] {
  return list.map((c) => (c.id === id ? next : c));
}

export function removeComment(list: readonly Comment[], id: string): Comment[] {
  return list.filter((c) => c.id !== id);
}

/* ─────────────────────────────── comment counts ─────────────────────────────── */

/** `Map<taskId, count>`; tasks without comments are absent. */
export function toCommentCountMap(rows: readonly CommentCountRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const { task_id } of rows) map.set(task_id, (map.get(task_id) ?? 0) + 1);
  return map;
}

export function addCountRow(rows: readonly CommentCountRow[], taskId: string): CommentCountRow[] {
  return [...rows, { task_id: taskId }];
}

/** Drops one row for the task (the same list when there is none). */
export function removeCountRow<T extends readonly CommentCountRow[]>(
  rows: T,
  taskId: string,
): T | CommentCountRow[] {
  const index = rows.findIndex((r) => r.task_id === taskId);
  return index === -1 ? rows : rows.toSpliced(index, 1);
}
