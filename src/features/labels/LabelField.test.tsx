import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import * as api from './api';
import { LabelField } from './LabelField';
import { mockLabelData } from './testApi';
import { makeLabel } from './testUtils';

vi.mock('./api', async () => (await import('./testApi')).apiMockFactory());

const LABELS = [
  makeLabel('l-bug', 'Bug', '#E5484D'),
  makeLabel('l-design', 'Design', '#D6409F'),
  makeLabel('l-feat', 'Feature', '#3E63DD'),
];
const LINKS = [
  { task_id: 't1', label_id: 'l-bug' },
  { task_id: 't2', label_id: 'l-bug' },
  { task_id: 't3', label_id: 'l-bug' },
];

const toggle = vi.fn<ReturnType<typeof api.useToggleTaskLabel>>(() => true);
const create = vi.fn<ReturnType<typeof api.useCreateLabel>>(async () => ({ ok: true }));
const update = vi.fn<ReturnType<typeof api.useUpdateLabel>>(async () => ({ ok: true }));
const remove = vi.fn<ReturnType<typeof api.useDeleteLabel>>();

beforeEach(() => {
  vi.clearAllMocks();
  mockLabelData(api, LABELS, LINKS);
  vi.mocked(api.useToggleTaskLabel).mockReturnValue(toggle);
  vi.mocked(api.useCreateLabel).mockReturnValue(create);
  vi.mocked(api.useUpdateLabel).mockReturnValue(update);
  vi.mocked(api.useDeleteLabel).mockReturnValue(remove);
});

const task = makeTask('t1', 'todo', 1000);

async function openPicker() {
  const user = userEvent.setup();
  render(<LabelField task={task} />);
  await user.click(screen.getByRole('button', { name: 'Labels: Bug' }));
  const dialog = await screen.findByRole('dialog', { name: 'Labels' });
  return { user, dialog };
}

describe('LabelField', () => {
  it('shows the task chips on the trigger, or "Add label"', () => {
    const { unmount } = render(<LabelField task={task} />);
    expect(screen.getByRole('button', { name: 'Labels: Bug' })).toHaveTextContent('Bug');
    unmount();
    render(<LabelField task={makeTask('t9', 'todo', 1000)} />);
    expect(screen.getByRole('button', { name: 'Add label' })).toHaveTextContent('Add label');
  });

  it('is disabled while the task is still being created', () => {
    render(<LabelField task={makeTask('temp-1', 'todo', 1000)} />);
    expect(screen.getByRole('button', { name: 'Add label' })).toBeDisabled();
  });

  it('toggles a label on and off from the checkbox list', async () => {
    const { user } = await openPicker();
    expect(screen.getByRole('checkbox', { name: 'Bug' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Design' })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Design' }));
    expect(toggle).toHaveBeenLastCalledWith('t1', 'l-design', true);
    await user.click(screen.getByRole('checkbox', { name: 'Bug' }));
    expect(toggle).toHaveBeenLastCalledWith('t1', 'l-bug', false);
  });

  it('focuses the search box and filters the list as you type', async () => {
    const { user } = await openPicker();
    const search = screen.getByRole('textbox', { name: 'Search or create label' });
    expect(search).toHaveFocus();
    await user.type(search, 'des');
    expect(screen.getAllByRole('checkbox')).toEqual([
      screen.getByRole('checkbox', { name: 'Design' }),
    ]);
  });

  it('creates a label with the next unused color and attaches it (Enter)', async () => {
    const { user } = await openPicker();
    const search = screen.getByRole('textbox', { name: 'Search or create label' });
    await user.type(search, '  Docs ');
    expect(screen.getByRole('button', { name: 'Create “Docs”' })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    // Red, blue and pink are taken; orange is the first free palette color.
    expect(create).toHaveBeenCalledWith({ name: 'Docs', color: '#F76B15' }, 't1');
    expect(search).toHaveValue('');
  });

  it('creates from the "Create" row too', async () => {
    const { user } = await openPicker();
    await user.type(screen.getByRole('textbox', { name: 'Search or create label' }), 'Infra');
    await user.click(screen.getByRole('button', { name: 'Create “Infra”' }));
    expect(create).toHaveBeenCalledWith({ name: 'Infra', color: '#F76B15' }, 't1');
  });

  it('attaches an existing label on Enter instead of creating a case-variant duplicate', async () => {
    const { user } = await openPicker();
    await user.type(screen.getByRole('textbox', { name: 'Search or create label' }), 'design');
    expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveBeenCalledWith('t1', 'l-design', true);
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the server duplicate-name error inline and restores the text', async () => {
    create.mockResolvedValueOnce({ ok: false, error: 'A label named “Docs” already exists' });
    const { user } = await openPicker();
    const search = screen.getByRole('textbox', { name: 'Search or create label' });
    await user.type(search, 'Docs{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A label named “Docs” already exists',
    );
    expect(search).toHaveValue('Docs');
    expect(search).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a name over 30 characters inline', async () => {
    const { user } = await openPicker();
    await user.type(
      screen.getByRole('textbox', { name: 'Search or create label' }),
      `${'x'.repeat(31)}{Enter}`,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('at most 30 characters');
    expect(create).not.toHaveBeenCalled();
  });

  it('renames and recolors a label inline', async () => {
    const { user } = await openPicker();
    await user.click(screen.getByRole('button', { name: 'Edit Design' }));
    const form = screen.getByRole('form', { name: 'Edit label Design' });
    const name = within(form).getByRole('textbox', { name: 'Label name' });
    expect(name).toHaveFocus();

    await user.clear(name);
    await user.type(name, 'UX');
    await user.click(within(form).getByRole('radio', { name: 'Green' }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(update).toHaveBeenCalledWith('l-design', { name: 'UX', color: '#30A46C' });
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('blocks a rename to an existing name (case-insensitive) with an inline error', async () => {
    const { user } = await openPicker();
    await user.click(screen.getByRole('button', { name: 'Edit Design' }));
    const name = screen.getByRole('textbox', { name: 'Label name' });
    await user.clear(name);
    await user.type(name, 'bug{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('A label named “Bug” already exists');
    expect(update).not.toHaveBeenCalled();
  });

  it('reopens the editor with the server duplicate error', async () => {
    update.mockResolvedValueOnce({ ok: false, error: 'A label named “Ops” already exists' });
    const { user } = await openPicker();
    await user.click(screen.getByRole('button', { name: 'Edit Feature' }));
    const name = screen.getByRole('textbox', { name: 'Label name' });
    await user.clear(name);
    await user.type(name, 'Ops{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A label named “Ops” already exists',
    );
    expect(screen.getByRole('textbox', { name: 'Label name' })).toHaveValue('Ops');
  });

  it('Escape leaves the editor without closing the popover', async () => {
    const { user, dialog } = await openPicker();
    await user.click(screen.getByRole('button', { name: 'Edit Design' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('deletes a label after an inline confirm that counts its tasks', async () => {
    const { user } = await openPicker();
    await user.click(screen.getByRole('button', { name: 'Delete Bug' }));
    const confirm = screen.getByRole('group', { name: /Delete “Bug”\?/ });
    expect(confirm).toHaveTextContent("Delete “Bug”? It's on 3 tasks.");
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith(LABELS[0]);
  });

  it('cancelling the delete confirm keeps the label', async () => {
    const { user } = await openPicker();
    await user.click(screen.getByRole('button', { name: 'Delete Feature' }));
    expect(screen.getByText(/It isn't on any tasks\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(remove).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Feature' })).toBeInTheDocument(),
    );
  });

  it('moves through the list with the arrow keys', async () => {
    const { user } = await openPicker();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('checkbox', { name: 'Bug' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('checkbox', { name: 'Design' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('textbox', { name: 'Search or create label' })).toHaveFocus();
  });
});
