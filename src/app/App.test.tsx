import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';
import { useSession } from '@/app/auth';
import { App } from './App';
import { Providers } from './providers';

vi.mock('@/app/auth', () => ({ useSession: vi.fn<typeof useSession>() }));

const mockedUseSession = vi.mocked(useSession);
const retry = vi.fn<() => void>();

function renderApp() {
  return render(
    <Providers>
      <App />
    </Providers>,
  );
}

afterEach(cleanup);

describe('App shell', () => {
  beforeEach(() => {
    retry.mockReset();
    window.history.replaceState(null, '', '/');
  });

  it('renders the header and the board skeleton while the session loads', () => {
    mockedUseSession.mockReturnValue({ status: 'loading', retry });
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: /sprint board/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
    expect(screen.getByRole('status', { busy: true })).toHaveTextContent(/loading your board/i);
    expect(screen.queryByRole('region', { name: 'To Do' })).not.toBeInTheDocument();
  });

  it('shows an error state with a working Retry when the session fails', async () => {
    mockedUseSession.mockReturnValue({
      status: 'error',
      error: new Error('Anonymous sign-ins are disabled'),
      retry,
    });
    renderApp();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't start your session");
    expect(alert).toHaveTextContent('Anonymous sign-ins are disabled');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders the board columns once the session is ready', () => {
    mockedUseSession.mockReturnValue({ status: 'ready', session: {} as Session, retry });
    renderApp();

    for (const name of ['To Do', 'In Progress', 'In Review', 'Done']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('status', { busy: true })).not.toBeInTheDocument();
  });

  it('opens the create-task overlay for To Do from the header button', async () => {
    mockedUseSession.mockReturnValue({ status: 'loading', retry });
    renderApp();

    await userEvent.click(screen.getByRole('button', { name: 'New task' }));
    expect(new URLSearchParams(window.location.search).get('new')).toBe('todo');
  });
});
