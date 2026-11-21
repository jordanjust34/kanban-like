import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import type * as Api from './api';
import { mockApi } from './apiMock';
import { AssigneeField } from './AssigneeField';
import { makeMember } from './testUtils';

vi.mock('./api', () => ({
  useMembers: vi.fn<typeof Api.useMembers>(),
  useTaskAssignees: vi.fn<typeof Api.useTaskAssignees>(),
  useAssignedTaskCounts: vi.fn<typeof Api.useAssignedTaskCounts>(),
  useCreateMember: vi.fn<typeof Api.useCreateMember>(),
  useUpdateMember: vi.fn<typeof Api.useUpdateMember>(),
  useDeleteMember: vi.fn<typeof Api.useDeleteMember>(),
  useToggleAssignee: vi.fn<typeof Api.useToggleAssignee>(),
}));

const maya = makeMember('m1', 'Maya Chen');
const leo = makeMember('m2', 'Leo Martins');
const task = makeTask('t1', 'todo', 1000);

describe('AssigneeField', () => {
  it('shows "No assignees" and still renders the trigger when empty', () => {
    mockApi({ members: [maya, leo] });
    render(<AssigneeField task={task} />);
    const trigger = screen.getByRole('button', { name: 'Assignees: No assignees' });
    expect(trigger).toHaveTextContent('No assignees');
  });

  it('shows the assignees on the trigger', () => {
    mockApi({ members: [maya, leo], links: [{ task_id: 't1', member_id: 'm2' }] });
    render(<AssigneeField task={task} />);
    expect(screen.getByRole('button', { name: 'Assignees: Leo Martins' })).toBeInTheDocument();
  });

  it('toggles members from the checkbox list', async () => {
    const user = userEvent.setup();
    const { toggle } = mockApi({
      members: [maya, leo],
      links: [{ task_id: 't1', member_id: 'm1' }],
    });
    render(<AssigneeField task={task} />);
    await user.click(screen.getByRole('button', { name: /^Assignees:/ }));
    const panel = screen.getByRole('dialog', { name: 'Assign members' });

    const mayaBox = within(panel).getByRole('checkbox', { name: 'Maya Chen' });
    expect(mayaBox).toBeChecked();
    await user.click(mayaBox);
    expect(toggle).toHaveBeenLastCalledWith('t1', 'm1', false);

    await user.click(within(panel).getByRole('checkbox', { name: 'Leo Martins' }));
    expect(toggle).toHaveBeenLastCalledWith('t1', 'm2', true);
  });

  it('is disabled while the task is still being created', () => {
    mockApi({ members: [maya] });
    render(<AssigneeField task={makeTask('temp-1', 'todo', 1000)} />);
    expect(screen.getByRole('button', { name: /^Assignees:/ })).toBeDisabled();
  });

  it('offers a quick filter above 6 members', async () => {
    const user = userEvent.setup();
    const many = ['Ann', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus'].map((n, i) =>
      makeMember(`m${i}`, n),
    );
    mockApi({ members: many });
    render(<AssigneeField task={task} />);
    await user.click(screen.getByRole('button', { name: /^Assignees:/ }));
    const filter = screen.getByRole('textbox', { name: 'Filter members' });
    expect(filter).toHaveFocus();
    await user.type(filter, 'g');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Gus' })).toBeInTheDocument();
  });

  it('opens team management in place and comes back', async () => {
    const user = userEvent.setup();
    mockApi({ members: [maya] });
    render(<AssigneeField task={task} />);
    await user.click(screen.getByRole('button', { name: /^Assignees:/ }));
    await user.click(screen.getByRole('button', { name: 'Manage team…' }));
    const panel = screen.getByRole('dialog', { name: 'Manage team' });
    expect(within(panel).getByRole('form', { name: 'Add member' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Back to assignees' }));
    expect(screen.getByRole('button', { name: 'Manage team…' })).toHaveFocus();
  });
});
