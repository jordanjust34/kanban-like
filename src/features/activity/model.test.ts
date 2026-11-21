import { describe, expect, it } from 'vitest';
import {
  addCountRow,
  buildFeed,
  describeActivity,
  removeCountRow,
  toCommentCountMap,
  type ActivityEntry,
  type Comment,
  type TextPart,
} from './model';

let nextId = 1;
function entry(
  kind: string,
  payload: ActivityEntry['payload'],
  created_at = '2026-11-20T10:00:00.000Z',
) {
  return { id: nextId++, task_id: 't1', user_id: 'u1', kind, payload, created_at } as ActivityEntry;
}

function comment(id: string, created_at: string, body = 'Hi'): Comment {
  return { id, task_id: 't1', user_id: 'u1', body, created_at };
}

/** Flattens parts to text, with **bold** for emphasised parts. */
function text(parts: TextPart[]): string {
  return parts.map((p) => (p.strong ? `**${p.text}**` : p.text)).join('');
}

describe('describeActivity', () => {
  it('created', () => {
    expect(text(describeActivity(entry('created', { title: 'A' })))).toBe('created the task');
  });

  it('status_changed uses the status labels and accents', () => {
    const parts = describeActivity(entry('status_changed', { from: 'todo', to: 'in_progress' }));
    expect(text(parts)).toBe('moved from **To Do** → **In Progress**');
    expect(parts.filter((p) => p.strong).map((p) => p.color)).toEqual(['#8B8D98', '#3E63DD']);
  });

  it('status_changed with an unknown status shows the raw value', () => {
    expect(text(describeActivity(entry('status_changed', { from: 'todo', to: 'archived' })))).toBe(
      'moved from **To Do** → **archived**',
    );
  });

  it('edited: one field', () => {
    expect(text(describeActivity(entry('edited', { fields: ['title'] })))).toBe(
      'changed the title',
    );
  });

  it('edited: two fields joined with "and"', () => {
    expect(text(describeActivity(entry('edited', { fields: ['description', 'due_date'] })))).toBe(
      'updated the description and due date',
    );
  });

  it('edited: several fields joined with commas and "and"', () => {
    expect(
      text(describeActivity(entry('edited', { fields: ['title', 'priority', 'due_date'] }))),
    ).toBe('updated the title, priority and due date');
  });

  it('edited: no usable fields falls back', () => {
    expect(text(describeActivity(entry('edited', {})))).toBe('updated the task');
  });

  it('assignee added / removed use the payload snapshot name and color', () => {
    const added = describeActivity(
      entry('assignee_added', { id: 'm1', name: 'Maya Chen', color: '#3E63DD' }),
    );
    expect(text(added)).toBe('assigned **Maya Chen**');
    expect(added.at(-1)?.color).toBe('#3E63DD');
    expect(
      text(
        describeActivity(
          entry('assignee_removed', { id: 'm1', name: 'Maya Chen', color: '#3E63DD' }),
        ),
      ),
    ).toBe('unassigned **Maya Chen**');
  });

  it('label added / removed', () => {
    expect(
      text(describeActivity(entry('label_added', { id: 'l1', name: 'Bug', color: '#E5484D' }))),
    ).toBe('added label **Bug**');
    expect(
      text(describeActivity(entry('label_removed', { id: 'l1', name: 'Bug', color: '#E5484D' }))),
    ).toBe('removed label **Bug**');
  });

  it('falls back to the current name maps when the payload has no name', () => {
    const maps = { members: new Map([['m1', 'Maya']]), labels: new Map([['l1', 'Bug']]) };
    expect(text(describeActivity(entry('assignee_added', { id: 'm1' }), maps))).toBe(
      'assigned **Maya**',
    );
    expect(text(describeActivity(entry('label_added', { id: 'l1' }), maps))).toBe(
      'added label **Bug**',
    );
    expect(text(describeActivity(entry('label_added', { id: 'l9' })))).toBe(
      'added label **a deleted label**',
    );
  });

  it('unknown kinds fall back gracefully', () => {
    expect(text(describeActivity(entry('archived', [])))).toBe('updated the task');
  });
});

describe('buildFeed', () => {
  it('merges comments and activity oldest first', () => {
    const created = entry('created', { title: 'A' }, '2026-11-20T10:00:00.000Z');
    const moved = entry('status_changed', { from: 'todo', to: 'done' }, '2026-11-20T12:00:00.000Z');
    const c1 = comment('c1', '2026-11-20T11:00:00.000Z');
    const c2 = comment('c2', '2026-11-20T13:00:00.000Z');
    const feed = buildFeed([moved, created], [c2, c1]);
    expect(
      feed.map((i) => (i.type === 'comment' ? i.comment.id : i.entries.map((e) => e.kind))),
    ).toEqual([['created'], 'c1', ['status_changed'], 'c2']);
  });

  it('groups consecutive activity within a minute, ordered by id on ties', () => {
    const a = entry('status_changed', { from: 'todo', to: 'done' }, '2026-11-20T12:00:00.000Z');
    const b = entry('edited', { fields: ['title'] }, '2026-11-20T12:00:00.000Z');
    const c = entry('label_added', { name: 'Bug' }, '2026-11-20T12:00:40.000Z');
    const d = entry('label_removed', { name: 'Bug' }, '2026-11-20T12:05:00.000Z');
    const feed = buildFeed([d, c, b, a], []);
    expect(feed).toHaveLength(2);
    expect(feed[0]).toMatchObject({ type: 'activity', entries: [a, b, c] });
    expect(feed[1]).toMatchObject({ type: 'activity', entries: [d] });
  });

  it('a comment breaks an activity group', () => {
    const a = entry('edited', { fields: ['title'] }, '2026-11-20T12:00:00.000Z');
    const b = entry('edited', { fields: ['priority'] }, '2026-11-20T12:00:20.000Z');
    const c = comment('c1', '2026-11-20T12:00:10.000Z');
    expect(buildFeed([a, b], [c]).map((i) => i.type)).toEqual(['activity', 'comment', 'activity']);
  });

  it('activity sorts before a comment with the same timestamp', () => {
    const a = entry('created', {}, '2026-11-20T12:00:00.000Z');
    const c = comment('c1', '2026-11-20T12:00:00.000Z');
    expect(buildFeed([a], [c]).map((i) => i.type)).toEqual(['activity', 'comment']);
  });
});

describe('comment counts', () => {
  it('counts comments per task', () => {
    const map = toCommentCountMap([{ task_id: 'a' }, { task_id: 'b' }, { task_id: 'a' }]);
    expect(map.get('a')).toBe(2);
    expect(map.get('b')).toBe(1);
    expect(map.get('c')).toBeUndefined();
  });

  it('adds and removes one row for a task', () => {
    const rows = [{ task_id: 'a' }, { task_id: 'b' }, { task_id: 'a' }];
    expect(toCommentCountMap(addCountRow(rows, 'b')).get('b')).toBe(2);
    expect(toCommentCountMap(removeCountRow(rows, 'a')).get('a')).toBe(1);
    expect(removeCountRow(rows, 'zzz')).toBe(rows);
  });
});
