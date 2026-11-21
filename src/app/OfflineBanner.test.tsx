import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OfflineBanner', () => {
  it('appears when the browser goes offline and hides when it reconnects', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();

    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent(/you're offline/i);

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });
});
