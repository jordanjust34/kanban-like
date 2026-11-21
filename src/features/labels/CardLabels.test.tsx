import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeTask } from '@/features/tasks/testUtils';
import * as api from './api';
import { CardLabels } from './CardLabels';
import { LabelChip } from './LabelChip';
import { mockLabelData } from './testApi';
import { makeLabel } from './testUtils';

vi.mock('./api', async () => (await import('./testApi')).apiMockFactory());

const LABELS = [
  makeLabel('l1', 'Bug', '#E5484D'),
  makeLabel('l2', 'Chore', '#F5A524'),
  makeLabel('l3', 'Design', '#D6409F'),
  makeLabel('l4', 'Feature', '#3E63DD'),
  makeLabel('l5', 'Infra', '#30A46C'),
];

const link = (task_id: string, label_id: string) => ({ task_id, label_id });

describe('CardLabels', () => {
  it('renders nothing for a task without labels (so the card row collapses)', () => {
    mockLabelData(api, LABELS, [link('other', 'l1')]);
    const { container } = render(<CardLabels task={makeTask('t1', 'todo', 1000)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while labels are loading', () => {
    mockLabelData(api, undefined, undefined);
    const { container } = render(<CardLabels task={makeTask('t1', 'todo', 1000)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows up to 3 chips by name, then a "+N" chip listing the rest', () => {
    mockLabelData(
      api,
      LABELS,
      ['l5', 'l4', 'l3', 'l2', 'l1'].map((id) => link('t1', id)),
    );
    const { container } = render(<CardLabels task={makeTask('t1', 'todo', 1000)} />);

    expect([...container.children].map((el) => el.textContent)).toEqual([
      'Bug',
      'Chore',
      'Design',
      '+2',
    ]);
    expect(screen.getByText('+2')).toHaveAttribute('title', 'Feature, Infra');
  });

  it('shows exactly 3 chips without "+N"', () => {
    mockLabelData(
      api,
      LABELS,
      ['l1', 'l2', 'l3'].map((id) => link('t1', id)),
    );
    render(<CardLabels task={makeTask('t1', 'todo', 1000)} />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('is not interactive (the card is the button)', () => {
    mockLabelData(api, LABELS, [link('t1', 'l1')]);
    const { container } = render(<CardLabels task={makeTask('t1', 'todo', 1000)} />);
    expect(container.querySelector('button, [tabindex]')).toBeNull();
  });
});

describe('LabelChip', () => {
  it('uses the AA-safe tint and text colors', () => {
    render(<LabelChip name="Chore" color="#F5A524" />);
    const chip = screen.getByText('Chore').parentElement!;
    expect(chip.style.backgroundColor).not.toBe('');
    expect(chip.style.color).not.toBe('rgb(245, 165, 36)');
  });

  it('adds a remove button only when asked', async () => {
    const onRemove = vi.fn<() => void>();
    render(<LabelChip name="Bug" color="#E5484D" onRemove={onRemove} />);
    screen.getByRole('button', { name: 'Remove Bug' }).click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
