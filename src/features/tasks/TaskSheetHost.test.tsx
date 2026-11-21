import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/api';
import { makeTask } from './testUtils';
import type { Task } from './types';
import { TaskSheetHost } from './TaskSheetHost';

vi.mock('@/features/tasks/api', () => ({
  useTasks: vi.fn<typeof useTasks>(),
  useCreateTask: vi.fn<typeof useCreateTask>(),
  useUpdateTask: vi.fn<typeof useUpdateTask>(),
  useMoveTask: vi.fn<typeof useMoveTask>(),
  useDeleteTask: vi.fn<typeof useDeleteTask>(),
}));

const create = vi.fn<ReturnType<typeof useCreateTask>>(() => 'temp-1');
const update = vi.fn<ReturnType<typeof useUpdateTask>>(() => true);
const move = vi.fn<ReturnType<typeof useMoveTask>>(() => true);
const remove = vi.fn<ReturnType<typeof useDeleteTask>>();
vi.mocked(useCreateTask).mockReturnValue(create);
vi.mocked(useUpdateTask).mockReturnValue(update);
vi.mocked(useMoveTask).mockReturnValue(move);
vi.mocked(useDeleteTask).mockReturnValue(remove);

type TasksResult = ReturnType<typeof useTasks>;

function mockTasks(data: Task[] | undefined) {
  vi.mocked(useTasks).mockReturnValue({
    data,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn<() => void>(),
  } as unknown as TasksResult);
}

const task = makeTask('t1', 'todo', 1000, {
  title: 'Fix login bug',
  description: 'Users bounce between pages',
  priority: 'high',
  due_date: '2026-12-03',
});

function renderHost(search: string) {
  window.history.replaceState(null, '', `/${search}`);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TaskSheetHost />, { wrapper });
}

beforeEach(() => {
  for (const fn of [create, update, move, remove]) fn.mockClear();
  mockTasks([task]);
});

describe('TaskSheetHost routing', () => {
  it('renders nothing without ?task or ?new', () => {
    renderHost('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('?new=in_review opens the create dialog preset to In Review', () => {
    renderHost('?new=in_review');
    const dialog = screen.getByRole('dialog', { name: 'New task' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('in_review');
  });

  it('an unknown ?new value falls back to To Do', () => {
    renderHost('?new=bogus');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
  });

  it('creating calls create() with the form values and closes the dialog', async () => {
    renderHost('?new=in_progress');
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'New thing{Enter}');
    expect(create).toHaveBeenCalledWith({
      title: 'New thing',
      description: null,
      status: 'in_progress',
      priority: 'normal',
      due_date: null,
    });
    expect(window.location.search).toBe('');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('?task=<id> renders the detail sheet for that task', () => {
    renderHost('?task=t1');
    expect(screen.getByRole('dialog', { name: 'Fix login bug' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Task title' })).toHaveValue('Fix login bug');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('todo');
    expect(screen.getByRole('combobox', { name: 'Priority' })).toHaveValue('high');
    expect(screen.getByLabelText('Due date', { selector: 'input' })).toHaveValue('2026-12-03');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Users bounce between pages',
    );
  });

  it('an unknown id shows a not-found state whose Close clears the param', async () => {
    renderHost('?task=missing');
    expect(screen.getByRole('heading', { name: 'Task not found' })).toBeInTheDocument();
    const closes = screen.getAllByRole('button', { name: 'Close' });
    await userEvent.click(closes[closes.length - 1]!);
    expect(window.location.search).toBe('');
  });

  it('shows a skeleton (not "not found") while tasks are loading', () => {
    mockTasks(undefined);
    renderHost('?task=t1');
    expect(screen.getByRole('dialog', { name: 'Loading task' })).toBeInTheDocument();
    expect(screen.queryByText('Task not found')).toBeNull();
  });

  it('Escape closes the sheet', async () => {
    renderHost('?task=t1');
    await userEvent.keyboard('{Escape}');
    expect(window.location.search).toBe('');
  });
});

describe('TaskDetailSheet editing', () => {
  it('saves a trimmed title on Enter, and only when it changed', async () => {
    renderHost('?task=t1');
    const title = screen.getByRole('textbox', { name: 'Task title' });
    await userEvent.clear(title);
    await userEvent.type(title, '  Fix the login loop  {Enter}');
    expect(update).toHaveBeenCalledWith('t1', { title: 'Fix the login loop' });

    update.mockClear();
    await userEvent.click(title);
    await userEvent.tab();
    expect(update).not.toHaveBeenCalled();
  });

  it('Esc in the title reverts without saving or closing; empty titles are rejected', async () => {
    renderHost('?task=t1');
    const title = screen.getByRole('textbox', { name: 'Task title' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Something else{Escape}');
    expect(title).toHaveValue('Fix login bug');
    expect(update).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?task=t1');

    await userEvent.clear(title);
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('can’t be empty');
    expect(update).not.toHaveBeenCalled();
  });

  it('changing status calls move()', async () => {
    renderHost('?task=t1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'done');
    expect(move).toHaveBeenCalledWith({ id: 't1', status: 'done' });
  });

  it('priority, due date and description go through update()', async () => {
    renderHost('?task=t1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'low');
    expect(update).toHaveBeenCalledWith('t1', { priority: 'low' });

    await userEvent.click(screen.getByRole('button', { name: 'Clear due date' }));
    expect(update).toHaveBeenCalledWith('t1', { due_date: null });

    const description = screen.getByRole('textbox', { name: 'Description' });
    await userEvent.type(description, ' today');
    expect(update).not.toHaveBeenCalledWith('t1', expect.objectContaining({ description }));
    await userEvent.tab();
    expect(update).toHaveBeenCalledWith('t1', { description: 'Users bounce between pages today' });
  });

  it('reflects changes made underneath (e.g. a drag on the board)', () => {
    const view = renderHost('?task=t1');
    mockTasks([{ ...task, status: 'in_progress', title: 'Renamed elsewhere' }]);
    view.rerender(<TaskSheetHost />);
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('in_progress');
    expect(screen.getByRole('textbox', { name: 'Task title' })).toHaveValue('Renamed elsewhere');
  });

  it('Delete calls remove(task) and closes the sheet', async () => {
    renderHost('?task=t1');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith(task);
    expect(window.location.search).toBe('');
  });

  it('disables editing while the task still has a temp id', () => {
    mockTasks([makeTask('temp-abc', 'todo', 1000, { title: 'Just created' })]);
    renderHost('?task=temp-abc');
    expect(screen.getByRole('textbox', { name: 'Task title' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('follows the real id once the optimistic task is saved', () => {
    const temp = makeTask('temp-abc', 'todo', 1000, { title: 'Just created' });
    mockTasks([temp]);
    const view = renderHost('?task=temp-abc');
    mockTasks([{ ...temp, id: 'real-1' }]);
    act(() => view.rerender(<TaskSheetHost />));
    expect(window.location.search).toBe('?task=real-1');
    expect(screen.getByRole('textbox', { name: 'Task title' })).toBeEnabled();
  });
});
