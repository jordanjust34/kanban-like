import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import * as api from './api';
import type * as Api from './api';
import { CardCommentCount } from './CardCommentCount';
import type { ActivityEntry, Comment } from './model';
import { TaskFeed } from './TaskFeed';

vi.mock('./api', () => ({
  useActivity: vi.fn<typeof Api.useActivity>(),
  useComments: vi.fn<typeof Api.useComments>(),
  useCommentCounts: vi.fn<typeof Api.useCommentCounts>(),
  useAddComment: vi.fn<typeof Api.useAddComment>(),
  useDeleteComment: vi.fn<typeof Api.useDeleteComment>(),
  useRefreshActivityOnChange: vi.fn<typeof Api.useRefreshActivityOnChange>(),
}));

const ACTIVITY: ActivityEntry[] = [
  {
    id: 1,
    task_id: 't1',
    user_id: 'u1',
    kind: 'created',
    payload: { title: 'A' },
    created_at: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 2,
    task_id: 't1',
    user_id: 'u1',
    kind: 'status_changed',
    payload: { from: 'todo', to: 'in_progress' },
    created_at: '2026-11-20T12:00:00.000Z',
  },
];
const COMMENTS: Comment[] = [
  {
    id: 'c1',
    task_id: 't1',
    user_id: 'u1',
    body: 'First line\nsecond line',
    created_at: '2026-11-20T11:00:00.000Z',
  },
];

const add = vi.fn<ReturnType<typeof api.useAddComment>>(() => true);
const remove = vi.fn<ReturnType<typeof api.useDeleteComment>>();

function mockQueries(
  activity: Partial<ReturnType<typeof api.useActivity>>,
  comments: Partial<ReturnType<typeof api.useComments>>,
) {
  vi.mocked(api.useActivity).mockReturnValue(activity as ReturnType<typeof api.useActivity>);
  vi.mocked(api.useComments).mockReturnValue(comments as ReturnType<typeof api.useComments>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueries({ data: ACTIVITY }, { data: COMMENTS });
  vi.mocked(api.useAddComment).mockReturnValue(add);
  vi.mocked(api.useDeleteComment).mockReturnValue(remove);
});

describe('TaskFeed', () => {
  it('renders activity and comments merged, oldest first', () => {
    render(<TaskFeed taskId="t1" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('You created the task'),
      expect.stringContaining('First line\nsecond line'),
      expect.stringContaining('You moved from To Do → In Progress'),
    ]);
    expect(items[0]?.querySelector('time')).toHaveAttribute('dateTime', ACTIVITY[0]?.created_at);
  });

  it('shows skeletons while loading, and nothing for a temp task', () => {
    mockQueries({ data: undefined }, { data: undefined });
    const { container, unmount } = render(<TaskFeed taskId="t1" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    unmount();
    const temp = render(<TaskFeed taskId="temp-1" />);
    expect(temp.container).toBeEmptyDOMElement();
  });

  it('shows "No activity yet" when the task has no rows', () => {
    mockQueries({ data: [] }, { data: [] });
    render(<TaskFeed taskId="t1" />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows an inline error with Retry', async () => {
    const refetch = vi.fn<() => void>();
    mockQueries({ data: undefined, isError: true, refetch } as never, { data: COMMENTS });
    render(<TaskFeed taskId="t1" />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load activity.");
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('composer: send is disabled until there is text; ⌘Enter sends, clears and keeps focus', async () => {
    const user = userEvent.setup();
    render(<TaskFeed taskId="t1" />);
    const box = screen.getByRole('textbox', { name: 'Comment' });
    const send = screen.getByRole('button', { name: 'Send comment' });
    expect(send).toBeDisabled();

    await user.type(box, '   ');
    expect(send).toBeDisabled();

    await user.clear(box);
    await user.type(box, 'Hello{Enter}world');
    expect(box).toHaveValue('Hello\nworld');
    expect(add).not.toHaveBeenCalled();

    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(add).toHaveBeenCalledWith('t1', 'Hello\nworld');
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
  });

  it('composer: Ctrl+Enter sends too; Esc blurs the field', async () => {
    const user = userEvent.setup();
    render(<TaskFeed taskId="t1" />);
    const box = screen.getByRole('textbox', { name: 'Comment' });
    expect(box).toHaveAttribute('data-esc-local');
    await user.type(box, 'Hi');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(add).toHaveBeenCalledWith('t1', 'Hi');
    await user.click(box);
    await user.keyboard('{Escape}');
    expect(box).not.toHaveFocus();
  });

  it('deletes a comment after confirming', async () => {
    const user = userEvent.setup();
    render(<TaskFeed taskId="t1" />);
    await user.click(screen.getByRole('button', { name: 'Delete comment' }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledWith(COMMENTS[0]);
  });
});

describe('CardCommentCount', () => {
  it('shows the count with an accessible noun', () => {
    vi.mocked(api.useCommentCounts).mockReturnValue(
      new Map([
        ['t1', 3],
        ['t2', 1],
      ]),
    );
    const { container, rerender } = render(<CardCommentCount task={makeTask('t1', 'todo', 1)} />);
    expect(container).toHaveTextContent('3 comments');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<CardCommentCount task={makeTask('t2', 'todo', 1)} />);
    expect(container).toHaveTextContent('1 comment');
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders nothing at zero or while loading', () => {
    vi.mocked(api.useCommentCounts).mockReturnValue(new Map());
    const { container, rerender } = render(<CardCommentCount task={makeTask('t9', 'todo', 1)} />);
    expect(container).toBeEmptyDOMElement();
    vi.mocked(api.useCommentCounts).mockReturnValue(undefined);
    rerender(<CardCommentCount task={makeTask('t9', 'todo', 1)} />);
    expect(container).toBeEmptyDOMElement();
  });
});
