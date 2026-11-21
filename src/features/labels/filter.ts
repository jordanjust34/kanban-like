import { useCallback, useMemo } from 'react';
import type { FilterGroup, FilterOption } from '@/features/filters/types';
import type { Task } from '@/features/tasks/types';
import { useLabels, useTaskLabels } from './api';
import type { Label, TaskLabelMap } from './labelList';

const NO_OPTIONS: FilterOption[] = [];

export function toLabelOptions(labels: readonly Label[]): FilterOption[] {
  return labels.map((l) => ({ id: l.id, label: l.name, color: l.color }));
}

/** True when any of the task's labels is selected. */
export function matchesLabels(
  map: TaskLabelMap | undefined,
  task: Task,
  selected: readonly string[],
): boolean {
  const ids = map?.get(task.id);
  return !!ids && ids.some((id) => selected.includes(id));
}

/** Always calls the same hooks; `options` / `matches` only change when the data does. */
function useLabelGroup() {
  const { data: labels } = useLabels();
  const { data: map } = useTaskLabels();
  const options = useMemo(() => (labels ? toLabelOptions(labels) : NO_OPTIONS), [labels]);
  const matches = useCallback(
    (task: Task, selected: readonly string[]) => matchesLabels(map, task, selected),
    [map],
  );
  return { options, matches };
}

export const labelFilterGroup: FilterGroup | null = {
  key: 'label',
  label: 'Label',
  useGroup: useLabelGroup,
};
