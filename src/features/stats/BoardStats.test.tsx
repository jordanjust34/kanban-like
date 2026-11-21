import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTasks } from '@/features/tasks/api';
import { makeTask } from '@/features/tasks/testUtils';
import type { Task } from '@/features/tasks/types';
import { BoardStats } from './BoardStats';

vi.mock('@/features/tasks/api', () => ({ useTasks: vi.fn<typeof useTasks>() }));

const mockedUseTasks = vi.mocked(useTasks);

function mockTasks(result: { data?: Task[]; isError?: boolean }) {
  mockedUseTasks.mockReturnValue({
    data: result.data,
    isError: result.isError ?? false,
  } as unknown as ReturnType<typeof useTasks>);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2026, 10, 20, 10, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const BOARD = [
  makeTask('a', 'todo', 1, { due_date: '2026-11-17' }), // overdue
  makeTask('b', 'in_progress', 1, { due_date: '2026-11-20' }),
  makeTask('c', 'in_review', 1),
  makeTask('d', 'done', 1, { due_date: '2026-11-01' }), // done + past due: not overdue
];

describe('BoardStats', () => {
  it('renders nothing while loading', () => {
    mockTasks({});
    const { container } = render(<BoardStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on error', () => {
    mockTasks({ data: BOARD, isError: true });
    const { container } = render(<BoardStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows total, done with a progress bar, and overdue in red', () => {
    mockTasks({ data: BOARD });
    const { container } = render(<BoardStats />);
    const group = screen.getByRole('group', { name: 'Board summary' });
    expect(group).toHaveTextContent('4 total');
    expect(group).toHaveTextContent('1 done 25%');
    expect(group).toHaveTextContent('1/4 done · 1 overdue');

    const bar = screen.getByRole('progressbar', { name: 'Tasks done' });
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(bar).toHaveAttribute('aria-valuetext', '1 of 4 tasks done (25%)');
    expect(bar.firstElementChild).toHaveStyle({ width: '25%' });

    expect(container.querySelector('.bg-danger-soft')).toHaveTextContent('1 overdue');
  });

  it('keeps overdue neutral when there is none', () => {
    mockTasks({ data: [makeTask('a', 'todo', 1, { due_date: '2026-11-25' })] });
    const { container } = render(<BoardStats />);
    expect(screen.getByRole('group')).toHaveTextContent('0/1 done · 0 overdue');
    expect(container.querySelector('.bg-danger-soft')).toBeNull();
    expect(container.querySelector('.text-danger-text')).toBeNull();
  });

  it('is all zeros on an empty board', () => {
    mockTasks({ data: [] });
    render(<BoardStats />);
    expect(screen.getByRole('group')).toHaveTextContent('0 total');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('updates when the cached list changes', () => {
    mockTasks({ data: BOARD });
    const { rerender } = render(<BoardStats />);
    mockTasks({ data: BOARD.map((t) => (t.id === 'a' ? { ...t, status: 'done' as const } : t)) });
    rerender(<BoardStats />);
    expect(screen.getByRole('group')).toHaveTextContent('2/4 done · 0 overdue');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });
});
