import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('gives an icon-only button its accessible name from aria-label', () => {
    render(<Button icon={<Trash2 />} aria-label="Delete task" variant="ghost" />);
    expect(screen.getByRole('button', { name: 'Delete task' })).toBeInTheDocument();
  });

  it('requires aria-label for icon-only buttons at the type level', () => {
    // @ts-expect-error: icon-only buttons must have an aria-label
    const element = <Button icon={<Trash2 />} />;
    expect(element).toBeTruthy();
  });

  it('is disabled, busy and ignores clicks while loading', async () => {
    const onClick = vi.fn<() => void>();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick and defaults to type="button" when idle', async () => {
    const onClick = vi.fn<() => void>();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('aria-busy');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
