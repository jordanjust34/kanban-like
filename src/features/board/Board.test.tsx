import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  useCreateTask,
  useTasks,
  type useDeleteTask,
  type useMoveTask,
} from '@/features/tasks/api';
import { makeTask } from '@/features/tasks/testUtils';
import type { Task } from '@/features/tasks/types';
import { Board } from './Board';

vi.mock('@/features/tasks/api', () => ({
  useTasks: vi.fn<typeof useTasks>(),
  useCreateTask: vi.fn<typeof useCreateTask>(),
  useMoveTask: () => vi.fn<ReturnType<typeof useMoveTask>>(() => true),
  useDeleteTask: () => vi.fn<ReturnType<typeof useDeleteTask>>(),
}));

type TasksResult = ReturnType<typeof useTasks>;
const mockedUseTasks = vi.mocked(useTasks);
const createTask = vi.fn<ReturnType<typeof useCreateTask>>(() => 'temp-1');
vi.mocked(useCreateTask).mockReturnValue(createTask);
const refetch = vi.fn<() => void>();

function mockTasks(result: { data?: Task[]; isError?: boolean; error?: Error }) {
  mockedUseTasks.mockReturnValue({
    data: result.data,
    isError: result.isError ?? false,
    error: result.error ?? null,
    isFetching: false,
    refetch,
  } as unknown as TasksResult);
}

function renderBoard(): ReturnType<typeof render> {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<Board />, { wrapper });
}

beforeEach(() => {
  refetch.mockReset();
  createTask.mockClear();
  window.history.replaceState(null, '', '/');
});

describe('Board', () => {
  it('renders the four columns in order with task counts', () => {
    mockTasks({
      data: [
        makeTask('a', 'todo', 1000, { title: 'Fix login bug', priority: 'high' }),
        makeTask('b', 'todo', 2000),
        makeTask('c', 'in_progress', 1000),
        makeTask('d', 'done', 1000),
      ],
    });
    renderBoard();

    const regions = screen.getAllByRole('region');
    expect(regions.map((r) => within(r).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'To Do',
      'In Progress',
      'In Review',
      'Done',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'To Do' })).getByLabelText('2 tasks'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'In Review' })).getByLabelText('0 tasks'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fix login bug/ })).toHaveTextContent('High');
  });

  it('shows a hint in empty columns', () => {
    mockTasks({ data: [makeTask('a', 'todo', 1000)] });
    renderBoard();
    expect(
      within(screen.getByRole('region', { name: 'In Review' })).getByText('No tasks'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'To Do' })).queryByText('No tasks'),
    ).toBeNull();
  });

  it('opens the task from a card click and from Enter', async () => {
    mockTasks({ data: [makeTask('a', 'todo', 1000, { title: 'Fix login bug' })] });
    renderBoard();
    const card = screen.getByRole('button', { name: /^Fix login bug/ });

    await userEvent.click(card);
    expect(new URLSearchParams(window.location.search).get('task')).toBe('a');

    window.history.replaceState(null, '', '/');
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(new URLSearchParams(window.location.search).get('task')).toBe('a');
  });

  it('shows an error state whose Retry refetches', async () => {
    mockTasks({ isError: true, error: new Error('permission denied for table tasks') });
    renderBoard();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load your board");
    expect(alert).toHaveTextContent('permission denied for table tasks');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the skeleton while loading', () => {
    mockTasks({});
    renderBoard();
    expect(screen.getByRole('status', { busy: true })).toHaveTextContent(/loading your board/i);
  });

  it('shows the first-run prompt on an empty board, still with four columns', async () => {
    mockTasks({ data: [] });
    renderBoard();

    expect(screen.getAllByRole('region')).toHaveLength(4);
    const todo = screen.getByRole('region', { name: 'To Do' });
    expect(within(todo).getByText('Plan your first task')).toBeInTheDocument();

    await userEvent.click(within(todo).getByRole('button', { name: 'Create a task' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New task in To Do' }),
      'First!{Enter}',
    );
    expect(createTask).toHaveBeenCalledWith({ title: 'First!', status: 'todo' });
  });

  it('opens quick-add in the column whose + was pressed', async () => {
    mockTasks({ data: [makeTask('a', 'todo', 1000)] });
    renderBoard();

    await userEvent.click(screen.getByRole('button', { name: 'Add task to In Review' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'New task in In Review' }),
      'Review me{Enter}',
    );
    expect(createTask).toHaveBeenCalledWith({ title: 'Review me', status: 'in_review' });
  });
});
