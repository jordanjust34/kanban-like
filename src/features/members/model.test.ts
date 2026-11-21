import { describe, expect, it } from 'vitest';
import { SWATCHES } from '@/lib/domain';
import {
  applyToggle,
  groupAssignees,
  initials,
  joinNames,
  nextFreeColor,
  removeMemberLinks,
  replaceMember,
  validateMember,
  type AssigneeLink,
} from './model';
import { makeMember } from './testUtils';

const links: AssigneeLink[] = [
  { task_id: 't1', member_id: 'm1' },
  { task_id: 't2', member_id: 'm1' },
  { task_id: 't2', member_id: 'm2' },
];

describe('initials', () => {
  it.each([
    ['Maya Chen', 'MC'],
    ['leo', 'L'],
    ['Priya  van der Shah', 'PS'],
    ['  ', '?'],
    ['élodie durand', 'ÉD'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('joinNames', () => {
  it('joins with commas and a final "and"', () => {
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});

describe('applyToggle', () => {
  it('adds a link once, even when applied twice', () => {
    const once = applyToggle(links, 't1', 'm2', true);
    expect(applyToggle(once, 't1', 'm2', true)).toEqual(once);
    expect(once).toContainEqual({ task_id: 't1', member_id: 'm2' });
    expect(once).toHaveLength(4);
  });

  it('removes only the matching link', () => {
    expect(applyToggle(links, 't2', 'm1', false)).toEqual([
      { task_id: 't1', member_id: 'm1' },
      { task_id: 't2', member_id: 'm2' },
    ]);
  });

  it('is undone by the opposite toggle (rollback)', () => {
    const next = applyToggle(links, 't1', 'm1', false);
    expect(groupAssignees(applyToggle(next, 't1', 'm1', true)).get('t1')).toEqual(['m1']);
  });
});

describe('removeMemberLinks', () => {
  it('drops every link of the member', () => {
    expect(removeMemberLinks(links, 'm1')).toEqual([{ task_id: 't2', member_id: 'm2' }]);
  });
});

describe('groupAssignees', () => {
  it('maps task ids to member ids', () => {
    const map = groupAssignees(links);
    expect(map.get('t1')).toEqual(['m1']);
    expect(map.get('t2')).toEqual(['m1', 'm2']);
    expect(map.has('t3')).toBe(false);
  });
});

describe('members list', () => {
  it('replaces a temp row and keeps created_at order', () => {
    const a = makeMember('a', 'Ann', { created_at: '2026-11-20T10:00:00Z' });
    const temp = makeMember('temp-1', 'Bo', { created_at: '2026-11-21T10:00:00Z' });
    const saved = { ...temp, id: 'b', created_at: '2026-11-21T10:00:01Z' };
    expect(replaceMember([temp, a], 'temp-1', saved).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('picks the first unused palette color', () => {
    expect(nextFreeColor([])).toBe(SWATCHES[0]);
    expect(nextFreeColor([{ color: SWATCHES[0].toLowerCase() }])).toBe(SWATCHES[1]);
    expect(nextFreeColor(SWATCHES.map((color) => ({ color })))).toBe(SWATCHES[0]);
  });
});

describe('validateMember', () => {
  it('trims the name and empties a blank avatar URL', () => {
    expect(validateMember({ name: '  Maya ', color: '#E5484D', avatarUrl: ' ' })).toEqual({
      ok: true,
      value: { name: 'Maya', color: '#E5484D', avatar_url: null },
    });
  });

  it('requires a name and an http(s) avatar URL', () => {
    expect(validateMember({ name: ' ', color: '#E5484D', avatarUrl: 'javascript:x' })).toEqual({
      ok: false,
      errors: {
        name: 'Name is required',
        avatar_url: 'Use a link that starts with http:// or https://',
      },
    });
    expect(
      validateMember({ name: 'A', color: '#E5484D', avatarUrl: 'https://x.dev/a.png' }).ok,
    ).toBe(true);
  });
});
