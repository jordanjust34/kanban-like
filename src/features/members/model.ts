/**
 * Pure helpers for team members and task↔member links. No React, no Supabase: the cache
 * updates in `api.ts` and the UI both build on these, and they are unit-tested on their own.
 */
import type { Tables } from '@/lib/database.types';
import { LIMITS, SWATCHES } from '@/lib/domain';

export type Member = Tables<'team_members'>;

/** One `task_assignees` row as fetched (`select('task_id, member_id')`). */
export type AssigneeLink = { task_id: string; member_id: string };

export type MemberInput = { name: string; color: string; avatar_url: string | null };

/* ─────────────────────────────── members ─────────────────────────────── */

/** Same order as the query: `created_at`, then name (seeded members share a timestamp). */
export function sortMembers(members: Member[]): Member[] {
  return [...members].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name),
  );
}

export function upsertMember(members: Member[], member: Member): Member[] {
  return sortMembers([...members.filter((m) => m.id !== member.id), member]);
}

/** Swaps an optimistic row (temp id) for the saved one, keeping the list order. */
export function replaceMember(members: Member[], tempId: string, member: Member): Member[] {
  return sortMembers([...members.filter((m) => m.id !== tempId && m.id !== member.id), member]);
}

export function patchMember(members: Member[], id: string, patch: Partial<MemberInput>): Member[] {
  return members.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

export function removeMember(members: Member[], id: string): Member[] {
  return members.filter((m) => m.id !== id);
}

/** First palette color no member uses yet (the first swatch when all are taken). */
export function nextFreeColor(members: readonly Pick<Member, 'color'>[]): string {
  const used = new Set(members.map((m) => m.color.toLowerCase()));
  return SWATCHES.find((s) => !used.has(s.toLowerCase())) ?? SWATCHES[0];
}

/* ──────────────────────────────── links ──────────────────────────────── */

/** Adds or removes one link. Idempotent: assigning twice never duplicates a row. */
export function applyToggle(
  links: AssigneeLink[],
  taskId: string,
  memberId: string,
  assigned: boolean,
): AssigneeLink[] {
  const rest = links.filter((l) => !(l.task_id === taskId && l.member_id === memberId));
  return assigned ? [...rest, { task_id: taskId, member_id: memberId }] : rest;
}

/** Drops every link to `memberId` (mirrors the DB's ON DELETE CASCADE). */
export function removeMemberLinks(links: AssigneeLink[], memberId: string): AssigneeLink[] {
  return links.filter((l) => l.member_id !== memberId);
}

/** `Map<taskId, memberId[]>`, in fetch order. */
export function groupAssignees(links: AssigneeLink[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { task_id, member_id } of links) {
    const ids = map.get(task_id);
    if (ids) ids.push(member_id);
    else map.set(task_id, [member_id]);
  }
  return map;
}

/* ─────────────────────────────── display ─────────────────────────────── */

/** "Maya Chen" → "MC", "Leo" → "L", "  " → "?". Uses the first and last word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letter = (word: string) => Array.from(word)[0]?.toLocaleUpperCase() ?? '';
  return letter(first) + (last ? letter(last) : '');
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Maya Chen" → "Maya". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/* ───────────────────────────── validation ────────────────────────────── */

export type MemberFormErrors = { name?: string; avatar_url?: string };

export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(value)) return false;
  return URL.canParse(value);
}

/** Trims and validates a member form. Returns the cleaned input or the field errors. */
export function validateMember(raw: {
  name: string;
  color: string;
  avatarUrl: string;
}): { ok: true; value: MemberInput } | { ok: false; errors: MemberFormErrors } {
  const name = raw.name.trim();
  const avatarUrl = raw.avatarUrl.trim();
  const errors: MemberFormErrors = {};
  if (!name) errors.name = 'Name is required';
  else if (name.length > LIMITS.memberName)
    errors.name = `Keep it under ${LIMITS.memberName} characters`;
  if (avatarUrl && !isHttpUrl(avatarUrl))
    errors.avatar_url = 'Use a link that starts with http:// or https://';
  if (errors.name || errors.avatar_url) return { ok: false, errors };
  return { ok: true, value: { name, color: raw.color, avatar_url: avatarUrl || null } };
}

/* ─────────────────────────────── errors ──────────────────────────────── */

/** Postgres foreign_key_violation: the task or member was deleted (or isn't ours). */
export function isForeignKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23503';
}

/** Postgres unique_violation: the link already exists. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
