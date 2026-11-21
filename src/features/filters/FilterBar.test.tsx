import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar';
import { NoResults } from './NoResults';

// The members/labels filter groups call data hooks that need a QueryClient + session; these
// tests cover the filter framework itself, so only the built-in priority group is registered.
vi.mock('@/features/members/filter', () => ({ assigneeFilterGroup: null }));
vi.mock('@/features/labels/filter', () => ({ labelFilterGroup: null }));

const params = () => new URLSearchParams(window.location.search);

function setUrl(search: string) {
  window.history.replaceState(null, '', `/${search}`);
}

/** jsdom has no `matchMedia`; a static stub is enough (the viewport never changes mid-test). */
function mockViewport(mobile: boolean) {
  const noop = () => {};
  window.matchMedia = ((query: string) => ({
    matches: mobile,
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  setUrl('');
  mockViewport(false);
});

describe('FilterBar', () => {
  it('writes the search text to ?q= without adding history entries', async () => {
    const user = userEvent.setup();
    const before = window.history.length;
    render(<FilterBar />);

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'login');

    expect(params().get('q')).toBe('login');
    expect(window.history.length).toBe(before);
  });

  it('shows the query from the URL and clears it on Escape', async () => {
    const user = userEvent.setup();
    setUrl('?q=docs');
    render(<FilterBar />);
    const search = screen.getByRole('searchbox', { name: 'Search tasks' });
    expect(search).toHaveValue('docs');

    await user.click(search);
    await user.keyboard('{Escape}');

    expect(params().has('q')).toBe(false);
    expect(search).toHaveValue('');
    expect(search).not.toHaveFocus();
  });

  it('focuses search on "/" but not while typing in another field', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FilterBar />
        <input aria-label="Other field" />
      </>,
    );
    const search = screen.getByRole('searchbox', { name: 'Search tasks' });

    await user.click(screen.getByRole('textbox', { name: 'Other field' }));
    await user.keyboard('/');
    expect(search).not.toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Other field' })).toHaveValue('/');

    await user.click(document.body);
    await user.keyboard('/');
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
  });

  it('adds a priority from the popover, shows a chip and removes it again', async () => {
    const user = userEvent.setup();
    render(<FilterBar />);

    await user.click(screen.getByRole('button', { name: 'Priority' }));
    const popover = screen.getByRole('dialog', { name: 'Filter by Priority' });
    await user.click(within(popover).getByRole('checkbox', { name: 'High' }));

    expect(params().getAll('priority')).toEqual(['high']);
    expect(within(popover).getByRole('checkbox', { name: 'High' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Priority, 1 selected' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Remove filter Priority: High' }));

    expect(params().has('priority')).toBe(false);
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();
  });

  it('ORs several priorities and clears the group from the popover', async () => {
    const user = userEvent.setup();
    setUrl('?priority=high&priority=low');
    render(<FilterBar />);

    expect(
      screen.getByRole('button', { name: 'Remove filter Priority: High' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter Priority: Low' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Priority, 2 selected' }));
    await user.click(screen.getByRole('button', { name: 'Clear Priority filter' }));
    expect(params().has('priority')).toBe(false);
  });

  it('"Clear filters" clears search and every group in one step', async () => {
    const user = userEvent.setup();
    setUrl('?q=bug&priority=high&label=l1&assignee=m1&task=t1');
    render(<FilterBar />);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(params().toString()).toBe('task=t1');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('adds a history entry per filter change so Back undoes it', async () => {
    const user = userEvent.setup();
    const before = window.history.length;
    render(<FilterBar />);

    await user.click(screen.getByRole('button', { name: 'Priority' }));
    await user.click(screen.getByRole('checkbox', { name: 'Low' }));

    expect(window.history.length).toBe(before + 1);
  });

  it('ignores unknown ids in the URL', () => {
    setUrl('?priority=urgent');
    render(<FilterBar />);
    expect(screen.getByRole('button', { name: 'Priority' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  describe('below 640 px', () => {
    beforeEach(() => mockViewport(true));

    it('keeps search and collapses the groups into one Filters button', async () => {
      const user = userEvent.setup();
      setUrl('?priority=high');
      render(<FilterBar />);

      expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Priority/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Filters, 1 active' }));
      const panel = screen.getByRole('dialog', { name: 'Filters' });
      expect(within(panel).getByRole('checkbox', { name: 'High' })).toBeChecked();

      await user.click(within(panel).getByRole('checkbox', { name: 'Normal' }));
      expect(params().getAll('priority')).toEqual(['high', 'normal']);

      await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
      expect(params().has('priority')).toBe(false);
    });
  });
});

describe('NoResults', () => {
  it('explains the empty result and offers to clear filters', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn<() => void>();
    render(<NoResults onClear={onClear} />);

    expect(
      screen.getByRole('heading', { name: 'No tasks match your filters' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
