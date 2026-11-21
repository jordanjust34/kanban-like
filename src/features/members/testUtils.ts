import type { Member } from './model';

/** Builds a team member row for tests. */
export function makeMember(id: string, name: string, patch: Partial<Member> = {}): Member {
  return {
    id,
    user_id: 'user-1',
    name,
    color: '#8E4EC6',
    avatar_url: null,
    created_at: '2026-11-20T10:00:00.000Z',
    ...patch,
  };
}
