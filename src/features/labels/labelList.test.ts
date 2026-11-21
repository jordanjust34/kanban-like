import { describe, expect, it } from 'vitest';
import { SWATCHES } from '@/lib/domain';
import {
  addLink,
  countTasksByLabel,
  isUniqueViolation,
  labelsForTask,
  nextLabelColor,
  patchLabel,
  relinkLabel,
  removeLabel,
  removeLink,
  removeLinksForLabel,
  replaceLabel,
  sortLabels,
  toTaskLabelMap,
  upsertLabel,
  validateLabelName,
  type Label,
  type TaskLabelLink,
} from './labelList';
import { makeLabel } from './testUtils';

const bug = makeLabel('l-bug', 'Bug', '#E5484D');
const feature = makeLabel('l-feat', 'Feature', '#3E63DD');
const design = makeLabel('l-design', 'design', '#D6409F');
const names = (labels: Label[]) => labels.map((l) => l.name);

describe('label list helpers', () => {
  it('sorts by name case-insensitively', () => {
    expect(names(sortLabels([feature, design, bug]))).toEqual(['Bug', 'design', 'Feature']);
  });

  it('upserts, patches and removes without mutating, keeping name order', () => {
    const list = [bug, feature];
    const withDesign = upsertLabel(list, design);
    expect(names(withDesign)).toEqual(['Bug', 'design', 'Feature']);
    expect(list).toEqual([bug, feature]);

    const renamed = patchLabel(withDesign, 'l-bug', { name: 'Zebra', color: '#30A46C' });
    expect(names(renamed)).toEqual(['design', 'Feature', 'Zebra']);
    expect(renamed.at(-1)?.color).toBe('#30A46C');

    expect(names(removeLabel(renamed, 'l-feat'))).toEqual(['design', 'Zebra']);
  });

  it('replaces an optimistic label with the saved row', () => {
    const temp = makeLabel('temp-1', 'Chore', '#F5A524');
    const saved = makeLabel('l-chore', 'Chore', '#F5A524');
    expect(replaceLabel([bug, temp], 'temp-1', saved).map((l) => l.id)).toEqual([
      'l-bug',
      'l-chore',
    ]);
  });
});

describe('link helpers', () => {
  const links: TaskLabelLink[] = [
    { task_id: 't1', label_id: 'l-bug' },
    { task_id: 't1', label_id: 'l-feat' },
    { task_id: 't2', label_id: 'l-bug' },
  ];

  it('adds a link once and removes it', () => {
    expect(addLink(links, 't2', 'l-feat')).toHaveLength(4);
    expect(addLink(links, 't1', 'l-bug')).toHaveLength(3);
    expect(removeLink(links, 't1', 'l-bug')).toEqual([links[1], links[2]]);
  });

  it('drops every link of a deleted label', () => {
    expect(removeLinksForLabel(links, 'l-bug')).toEqual([links[1]]);
  });

  it('re-points temp label links at the saved id', () => {
    const temp = [{ task_id: 't3', label_id: 'temp-1' }, ...links];
    expect(relinkLabel(temp, 'temp-1', 'l-new')[0]).toEqual({ task_id: 't3', label_id: 'l-new' });
  });

  it('maps tasks to label ids and resolves them in name order', () => {
    const map = toTaskLabelMap(links);
    expect(map.get('t1')).toEqual(['l-bug', 'l-feat']);
    expect(map.get('t3')).toBeUndefined();
    expect(names(labelsForTask([feature, bug], map, 't1'))).toEqual(['Bug', 'Feature']);
    expect(labelsForTask([feature], map, 't2')).toEqual([]);
  });

  it('counts tasks per label', () => {
    const counts = countTasksByLabel(links);
    expect(counts.get('l-bug')).toBe(2);
    expect(counts.get('l-feat')).toBe(1);
  });
});

describe('validateLabelName', () => {
  const labels = [bug, feature];

  it('trims the name', () => {
    expect(validateLabelName('  Docs  ', labels)).toEqual({ ok: true, name: 'Docs' });
  });

  it('rejects an empty name', () => {
    expect(validateLabelName('   ', labels)).toEqual({ ok: false, error: 'Enter a label name' });
  });

  it('allows 30 characters and rejects 31', () => {
    expect(validateLabelName('a'.repeat(30), labels).ok).toBe(true);
    expect(validateLabelName(`${'a'.repeat(31)} `, labels)).toEqual({
      ok: false,
      error: 'Label names can be at most 30 characters',
    });
  });

  it('rejects duplicates case-insensitively, naming the existing label', () => {
    expect(validateLabelName(' bug ', labels)).toEqual({
      ok: false,
      error: 'A label named “Bug” already exists',
    });
  });

  it('lets a label keep (or re-case) its own name', () => {
    expect(validateLabelName('BUG', labels, 'l-bug')).toEqual({ ok: true, name: 'BUG' });
  });
});

describe('nextLabelColor', () => {
  it('picks the first unused palette color', () => {
    expect(nextLabelColor([])).toBe(SWATCHES[0]);
    expect(nextLabelColor([{ color: '#e5484d' }, { color: '#F76B15' }])).toBe(SWATCHES[2]);
  });

  it('falls back to the least-used color once every color is taken', () => {
    const all = SWATCHES.map((color) => ({ color }));
    expect(nextLabelColor(all)).toBe(SWATCHES[0]);
    expect(nextLabelColor([...all, { color: SWATCHES[0] }])).toBe(SWATCHES[1]);
  });
});

describe('isUniqueViolation', () => {
  it('detects Postgres 23505 only', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key' })).toBe(true);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
