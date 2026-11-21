import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LIMITS, type Status } from '@/lib/domain';
import { TaskForm, type TaskFormValues } from './TaskForm';

function setup(initialStatus: Status = 'todo') {
  const onSubmit = vi.fn<(values: TaskFormValues) => void>();
  const onCancel = vi.fn<() => void>();
  render(<TaskForm initialStatus={initialStatus} onSubmit={onSubmit} onCancel={onCancel} />);
  const title = screen.getByRole('textbox', { name: 'Title' });
  return { onSubmit, onCancel, title };
}

describe('TaskForm', () => {
  it('autofocuses the title and rejects a whitespace-only title inline', async () => {
    const { onSubmit, title } = setup();
    expect(title).toHaveFocus();

    await userEvent.type(title, '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Give the task a title.');
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveFocus();

    await userEvent.type(title, 'x');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('submits defaults: preset status, normal priority, null description and due date', async () => {
    const { onSubmit, title } = setup('in_review');
    await userEvent.type(title, '  Write docs  {Enter}');

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Write docs',
      description: null,
      status: 'in_review',
      priority: 'normal',
      due_date: null,
    });
  });

  it('submits every field with ⌘/Ctrl+Enter', async () => {
    const { onSubmit, title } = setup();
    await userEvent.type(title, 'Ship the sheet');
    await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), '  Details  ');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'in_progress');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high');
    fireEvent.change(screen.getByLabelText('Due date', { selector: 'input' }), {
      target: { value: '2026-12-03' },
    });

    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Ship the sheet',
      description: 'Details',
      status: 'in_progress',
      priority: 'high',
      due_date: '2026-12-03',
    });
  });

  it('clears the due date with its clear button', async () => {
    const { onSubmit, title } = setup();
    fireEvent.change(screen.getByLabelText('Due date', { selector: 'input' }), {
      target: { value: '2026-12-03' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clear due date' }));
    await userEvent.type(title, 'No date{Enter}');
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ due_date: null }));
  });

  it('caps the title at the DB limit and cancels', async () => {
    const { onCancel, title } = setup();
    expect(title).toHaveAttribute('maxLength', String(LIMITS.taskTitle));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
