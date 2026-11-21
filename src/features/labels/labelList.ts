/**
 * Pure helpers over the cached labels and task↔label links. The optimistic mutations in
 * `api.ts` are built from these, so the interesting logic is unit-tested without a network.
 * No helper mutates its input.
 */
import type { Tables } from '@/lib/database.types';
import { LIMITS, SWATCHES } from '@/lib/domain';

export type Label = Tables<'labels'>;
export type TaskLabelLink = Pick<Tables<'task_labels'>, 'task_id' | 'label_id'>;
export type TaskLabelMap = ReadonlyMap<string, readonly string[]>;

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Stable display order: by name (case-insensitive), then id. */
export function compareLabels(a: Label, b: Label): number {
  return collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
}

export function sortLabels(labels: readonly Label[]): Label[] {
  return [...labels].sort(compareLabels);
}

/* ─────────────────────────────── labels ─────────────────────────────── */

/** Inserts or replaces (by id), keeping the list sorted. */
export function upsertLabel(labels: readonly Label[], label: Label): Label[] {
  return sortLabels([...labels.filter((l) => l.id !== label.id), label]);
}

export function patchLabel(
  labels: readonly Label[],
  id: string,
  patch: Partial<Pick<Label, 'name' | 'color'>>,
): Label[] {
  return sortLabels(labels.map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

export function removeLabel(labels: readonly Label[], id: string): Label[] {
  return labels.filter((l) => l.id !== id);
}

/** Swaps an optimistic (temp-id) label for the row the server returned. */
export function replaceLabel(labels: readonly Label[], tempId: string, label: Label): Label[] {
  return upsertLabel(removeLabel(labels, tempId), label);
}

/* ──────────────────────────────── links ──────────────────────────────── */

export function hasLink(links: readonly TaskLabelLink[], taskId: string, labelId: string): boolean {
  return links.some((l) => l.task_id === taskId && l.label_id === labelId);
}

export function addLink(
  links: readonly TaskLabelLink[],
  taskId: string,
  labelId: string,
): TaskLabelLink[] {
  return hasLink(links, taskId, labelId)
    ? [...links]
    : [...links, { task_id: taskId, label_id: labelId }];
}

export function removeLink(
  links: readonly TaskLabelLink[],
  taskId: string,
  labelId: string,
): TaskLabelLink[] {
  return links.filter((l) => !(l.task_id === taskId && l.label_id === labelId));
}

export function removeLinksForLabel(
  links: readonly TaskLabelLink[],
  labelId: string,
): TaskLabelLink[] {
  return links.filter((l) => l.label_id !== labelId);
}

export function linksForLabel(links: readonly TaskLabelLink[], labelId: string): TaskLabelLink[] {
  return links.filter((l) => l.label_id === labelId);
}

/** Points every link to `fromId` (an optimistic temp label) at `toId`. */
export function relinkLabel(
  links: readonly TaskLabelLink[],
  fromId: string,
  toId: string,
): TaskLabelLink[] {
  return links.map((l) => (l.label_id === fromId ? { ...l, label_id: toId } : l));
}

/** `task_id → label ids` (insertion order). */
export function toTaskLabelMap(links: readonly TaskLabelLink[]): TaskLabelMap {
  const map = new Map<string, string[]>();
  for (const { task_id, label_id } of links) {
    const list = map.get(task_id);
    if (list) list.push(label_id);
    else map.set(task_id, [label_id]);
  }
  return map;
}

/** The task's labels in display order; ids with no matching label are skipped. */
export function labelsForTask(
  labels: readonly Label[],
  map: TaskLabelMap,
  taskId: string,
): Label[] {
  const ids = map.get(taskId);
  if (!ids || ids.length === 0) return [];
  const wanted = new Set(ids);
  return labels.filter((l) => wanted.has(l.id)).sort(compareLabels);
}

/** Number of tasks carrying each label. */
export function countTasksByLabel(links: readonly TaskLabelLink[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { label_id } of links) counts.set(label_id, (counts.get(label_id) ?? 0) + 1);
  return counts;
}

/* ───────────────────────────── validation ───────────────────────────── */

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

export function duplicateNameMessage(name: string): string {
  return `A label named “${name}” already exists`;
}

/** Label with the same name, ignoring case and surrounding spaces (and `excludeId`). */
export function findLabelByName(
  labels: readonly Label[],
  name: string,
  excludeId?: string,
): Label | undefined {
  const key = name.trim().toLocaleLowerCase();
  return labels.find((l) => l.id !== excludeId && l.name.trim().toLocaleLowerCase() === key);
}

/**
 * Trims and checks a label name against the DB rules (1–30 characters) and, case-insensitively,
 * against existing labels (the DB's unique constraint is case-sensitive; "bug" next to "Bug"
 * would only confuse). `excludeId` is the label being renamed.
 */
export function validateLabelName(
  raw: string,
  labels: readonly Label[],
  excludeId?: string,
): NameCheck {
  const name = raw.trim();
  if (name === '') return { ok: false, error: 'Enter a label name' };
  if ([...name].length > LIMITS.labelName) {
    return { ok: false, error: `Label names can be at most ${LIMITS.labelName} characters` };
  }
  const existing = findLabelByName(labels, name, excludeId);
  if (existing) return { ok: false, error: duplicateNameMessage(existing.name) };
  return { ok: true, name };
}

/* ──────────────────────────────── color ──────────────────────────────── */

/** First palette color no label uses yet; once all are taken, the least-used one (palette order). */
export function nextLabelColor(labels: readonly Pick<Label, 'color'>[]): string {
  const uses = new Map<string, number>(SWATCHES.map((s) => [s.toLowerCase(), 0]));
  for (const { color } of labels) {
    const key = color.toLowerCase();
    const n = uses.get(key);
    if (n !== undefined) uses.set(key, n + 1);
  }
  let best: string = SWATCHES[0];
  let bestUses = Infinity;
  for (const swatch of SWATCHES) {
    const n = uses.get(swatch.toLowerCase()) ?? 0;
    if (n < bestUses) {
      best = swatch;
      bestUses = n;
    }
  }
  return best;
}

/* ──────────────────────────────── errors ──────────────────────────────── */

/** Postgres `unique_violation`, as returned by PostgREST. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
