import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarStack } from './Avatar';
import { makeMember } from './testUtils';

const team = [
  makeMember('m1', 'Maya Chen'),
  makeMember('m2', 'Leo Martins'),
  makeMember('m3', 'Priya Shah'),
  makeMember('m4', 'Sam Rivera'),
  makeMember('m5', 'Ana Lima'),
];

describe('AvatarStack', () => {
  it('shows every avatar and one short sentence when within the max', () => {
    const { container } = render(<AvatarStack members={team.slice(0, 3)} />);
    expect(screen.getByText('MC')).toBeInTheDocument();
    expect(screen.getByText('PS')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).toBeNull();
    expect(container).toHaveTextContent('Assigned to Maya Chen, Leo Martins and Priya Shah');
  });

  it('shows 3 avatars then "+N" with the rest in its title', () => {
    const { container } = render(<AvatarStack members={team} />);
    expect(screen.queryByText('SR')).toBeNull();
    const more = screen.getByText('+2');
    expect(more).toHaveAttribute('title', 'Sam Rivera, Ana Lima');
    expect(container).toHaveTextContent(
      'Assigned to Maya Chen, Leo Martins, Priya Shah and 2 more',
    );
  });

  it('respects a smaller max', () => {
    render(<AvatarStack members={team.slice(0, 3)} max={2} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders nothing for no members and contains no focusable element', () => {
    const { container, rerender } = render(<AvatarStack members={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AvatarStack members={team} />);
    expect(container.querySelector('button, a, [tabindex]')).toBeNull();
  });
});

describe('Avatar', () => {
  it('falls back to initials when the image fails', () => {
    const { container } = render(
      <Avatar member={makeMember('m1', 'Maya Chen', { avatar_url: 'https://x.dev/a.png' })} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('MC')).toBeInTheDocument();
  });
});
