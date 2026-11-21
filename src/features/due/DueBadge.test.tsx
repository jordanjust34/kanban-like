import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import { DueBadge } from './DueBadge';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(2026, 10, 20, 15, 0)); // Fri 20 Nov 2026, local
});

afterEach(() => {
  vi.useRealTimers();
});

function badge(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-tone]');
}

describe('DueBadge', () => {
  it('renders nothing without a due date', () => {
    const { container } = render(<DueBadge task={makeTask('a', 'todo', 1)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an overdue task in the danger tone with a full description', () => {
    const { container } = render(
      <DueBadge task={makeTask('a', 'todo', 1, { due_date: '2026-11-18' })} />,
    );
    const el = badge(container)!;
    expect(el).toHaveAttribute('data-tone', 'danger');
    expect(el).toHaveClass('text-danger-text');
    expect(el).toHaveTextContent('Overdue · 2d');
    expect(el).toHaveAttribute('title', 'Due Wed, Nov 18, 2026 — overdue by 2 days');
    expect(screen.getByText('Due Wed, Nov 18, 2026 — overdue by 2 days')).toHaveClass('sr-only');
  });

  it('shows due-soon tasks in the warning tone', () => {
    const { container } = render(
      <DueBadge task={makeTask('a', 'in_progress', 1, { due_date: '2026-11-21' })} />,
    );
    expect(badge(container)).toHaveAttribute('data-tone', 'warning');
    expect(badge(container)).toHaveTextContent('Tomorrow');
  });

  it('shows later tasks in the neutral tone', () => {
    const { container } = render(
      <DueBadge task={makeTask('a', 'todo', 1, { due_date: '2026-11-28' })} />,
    );
    expect(badge(container)).toHaveAttribute('data-tone', 'neutral');
    expect(badge(container)).toHaveTextContent('Nov 28');
    expect(badge(container)).toHaveAttribute('title', 'Due Sat, Nov 28, 2026');
  });

  it('mutes and strikes through a done task, never red', () => {
    const { container } = render(
      <DueBadge task={makeTask('a', 'done', 1, { due_date: '2026-11-10' })} />,
    );
    const el = badge(container)!;
    expect(el).toHaveAttribute('data-tone', 'done');
    expect(el).toHaveClass('line-through');
    expect(el).not.toHaveClass('text-danger-text');
    expect(el).toHaveTextContent('Nov 10');
  });

  it('flips at local midnight without a reload', () => {
    const { container } = render(
      <DueBadge task={makeTask('a', 'todo', 1, { due_date: '2026-11-21' })} />,
    );
    expect(badge(container)).toHaveTextContent('Tomorrow');
    act(() => {
      vi.advanceTimersByTime(9 * 60 * 60 * 1000 + 1000); // → 00:00:01 Sat
    });
    expect(badge(container)).toHaveTextContent('Today');
  });
});
