import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LIMITS } from '@/lib/domain';
import { QuickAdd } from './QuickAdd';

function setup() {
  const onCreate = vi.fn<(title: string) => void>();
  const onClose = vi.fn<() => void>();
  render(<QuickAdd status="todo" onCreate={onCreate} onClose={onClose} />);
  const input = screen.getByRole('textbox', { name: 'New task in To Do' });
  return { onCreate, onClose, input };
}

describe('QuickAdd', () => {
  it('rejects a whitespace-only title with an inline message', async () => {
    const { onCreate, input } = setup();
    await userEvent.type(input, '   {Enter}');

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Give the task a title.');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(input, 'x');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('creates on Enter with a trimmed title and stays open for the next one', async () => {
    const { onCreate, onClose, input } = setup();
    await userEvent.type(input, '  Ship it  {Enter}');
    expect(onCreate).toHaveBeenCalledWith('Ship it');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.type(input, 'Second{Enter}');
    expect(onCreate).toHaveBeenLastCalledWith('Second');
  });

  it('closes on Escape and on blur while empty, but not on blur with text', async () => {
    const { onClose, input } = setup();
    await userEvent.type(input, 'draft');
    await userEvent.tab();
    expect(onClose).not.toHaveBeenCalled();

    input.focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on blur when empty', async () => {
    const { onClose } = setup();
    await userEvent.tab();
    expect(onClose).toHaveBeenCalled();
  });

  it('caps the title at the DB limit', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('maxLength', String(LIMITS.taskTitle));
  });
});
