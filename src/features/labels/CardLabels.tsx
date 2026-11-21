import type { Task } from '@/features/tasks/types';
import { useLabelsForTask } from './api';
import { LabelChip, OverflowChip } from './LabelChip';

/** Chips shown on a card before "+N" (DESIGN §7.2). */
export const MAX_CARD_LABELS = 3;

/**
 * First row of the card: the task's labels by name, at most 3, then "+N" (its `title` lists the
 * rest). Non-interactive on purpose: the card itself is a draggable `role="button"`.
 */
export function CardLabels({ task }: { task: Task }) {
  const labels = useLabelsForTask(task.id);
  if (labels.length === 0) return null;
  const shown = labels.slice(0, MAX_CARD_LABELS);
  const rest = labels.slice(MAX_CARD_LABELS);
  return (
    <>
      {shown.map((label) => (
        <LabelChip key={label.id} name={label.name} color={label.color} />
      ))}
      {rest.length > 0 && (
        <OverflowChip count={rest.length} title={rest.map((l) => l.name).join(', ')} />
      )}
    </>
  );
}
