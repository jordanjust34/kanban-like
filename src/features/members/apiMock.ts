/**
 * Test helper for components that use `./api`. Each test file declares the module mock itself
 * (`vi.mock` is hoisted per file, so the factory can't import this file):
 *
 *   vi.mock('./api', () => ({ useMembers: vi.fn(), useTaskAssignees: vi.fn(), ... }));
 *
 * `mockApi` then sets every hook's return value and hands back the write spies.
 */
import { vi } from 'vitest';
import {
  useAssignedTaskCounts,
  useCreateMember,
  useDeleteMember,
  useMembers,
  useTaskAssignees,
  useToggleAssignee,
  useUpdateMember,
} from './api';
import { groupAssignees, type AssigneeLink, type Member } from './model';

export function mockApi({
  members,
  links = [],
  linksLoaded = true,
}: {
  members: Member[] | undefined;
  links?: AssigneeLink[];
  linksLoaded?: boolean;
}) {
  const create = vi.fn<ReturnType<typeof useCreateMember>>(() => 'temp-new');
  const update = vi.fn<ReturnType<typeof useUpdateMember>>(() => true);
  const remove = vi.fn<ReturnType<typeof useDeleteMember>>(() => true);
  const toggle = vi.fn<ReturnType<typeof useToggleAssignee>>(() => true);
  const map = linksLoaded ? groupAssignees(links) : undefined;
  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.member_id, (counts.get(l.member_id) ?? 0) + 1);

  vi.mocked(useMembers).mockReturnValue({
    data: members,
    isPending: members === undefined,
    isError: false,
  } as unknown as ReturnType<typeof useMembers>);
  vi.mocked(useTaskAssignees).mockReturnValue({
    data: map,
  } as unknown as ReturnType<typeof useTaskAssignees>);
  vi.mocked(useAssignedTaskCounts).mockReturnValue(counts);
  vi.mocked(useCreateMember).mockReturnValue(create);
  vi.mocked(useUpdateMember).mockReturnValue(update);
  vi.mocked(useDeleteMember).mockReturnValue(remove);
  vi.mocked(useToggleAssignee).mockReturnValue(toggle);
  return { create, update, remove, toggle };
}
