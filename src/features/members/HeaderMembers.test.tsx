import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type * as Api from './api';
import { mockApi } from './apiMock';
import { HeaderMembers } from './HeaderMembers';
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

const maya = makeMember('m1', 'Maya Chen', { color: '#8E4EC6' });
const leo = makeMember('m2', 'Leo Martins', { color: '#12A594' });
const links = [
  { task_id: 't1', member_id: 'm1' },
  { task_id: 't2', member_id: 'm1' },
];

async function openManager() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Manage team members' }));
  return { user, panel: screen.getByRole('dialog', { name: 'Team members' }) };
}

describe('HeaderMembers', () => {
  it('shows the team stack and an empty state when there is no team', async () => {
    mockApi({ members: [] });
    render(<HeaderMembers />);
    const { panel } = await openManager();
    expect(within(panel).getByText('No team members yet')).toBeInTheDocument();
  });

  it('adds a member with a trimmed name and the first unused color', async () => {
    const { create } = mockApi({ members: [maya, leo] });
    render(<HeaderMembers />);
    expect(screen.getByText('Team: Maya Chen and Leo Martins')).toBeInTheDocument();
    const { user, panel } = await openManager();
    const form = within(panel).getByRole('form', { name: 'Add member' });

    await user.click(within(form).getByRole('button', { name: 'Add' }));
    expect(within(form).getByText('Name is required')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText('Name'), '  Sam Rivera  ');
    await user.type(within(form).getByLabelText(/Avatar URL/), 'ftp://nope');
    await user.click(within(form).getByRole('button', { name: 'Add' }));
    expect(within(form).getByText(/http:\/\/ or https:\/\//)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.clear(within(form).getByLabelText(/Avatar URL/));
    await user.keyboard('{Enter}');
    expect(create).toHaveBeenCalledWith({ name: 'Sam Rivera', color: '#E5484D', avatar_url: null });
    expect(within(form).getByLabelText('Name')).toHaveValue('');
    expect(within(form).getByLabelText('Name')).toHaveFocus();
  });

  it('edits a member inline (rename + recolor), sending only changed fields', async () => {
    const { update } = mockApi({ members: [maya, leo] });
    render(<HeaderMembers />);
    const { user, panel } = await openManager();

    await user.click(within(panel).getByRole('button', { name: 'Edit Maya Chen' }));
    const form = within(panel).getByRole('form', { name: 'Edit member' });
    const name = within(form).getByLabelText('Name');
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, 'Maya C.');
    await user.click(within(form).getByRole('radio', { name: 'Blue' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(update).toHaveBeenCalledWith('m1', { name: 'Maya C.', color: '#3E63DD' });
    expect(within(panel).queryByRole('form', { name: 'Edit member' })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Edit Maya Chen' })).toHaveFocus();
  });

  it('cancels an edit without saving', async () => {
    const { update } = mockApi({ members: [maya] });
    render(<HeaderMembers />);
    const { user, panel } = await openManager();
    await user.click(within(panel).getByRole('button', { name: 'Edit Maya Chen' }));
    await user.click(within(panel).getByRole('button', { name: 'Cancel' }));
    expect(update).not.toHaveBeenCalled();
  });

  it('asks before removing a member and says how many tasks it affects', async () => {
    const { remove } = mockApi({ members: [maya, leo], links });
    render(<HeaderMembers />);
    const { user, panel } = await openManager();

    await user.click(within(panel).getByRole('button', { name: 'Remove Maya Chen' }));
    const confirm = within(panel).getByRole('group', {
      name: "Remove Maya? They'll be unassigned from 2 tasks.",
    });
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(remove).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole('button', { name: 'Remove Leo Martins' }));
    expect(within(panel).getByRole('group', { name: 'Remove Leo?' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Remove' }));
    expect(remove).toHaveBeenCalledWith('m2');
  });
});
