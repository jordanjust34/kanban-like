/**
 * Test helpers for components that use `./api`. Mock it with
 * `vi.mock('./api', async () => (await import('./testApi')).apiMockFactory())`, then call
 * `mockLabelData(api, labels, links)`.
 */
import { vi } from 'vitest';
import type * as Api from './api';
import { labelsForTask, toTaskLabelMap, type Label, type TaskLabelLink } from './labelList';

export const apiMockFactory = () => ({
  useLabels: vi.fn<typeof Api.useLabels>(),
  useTaskLabels: vi.fn<typeof Api.useTaskLabels>(),
  useTaskLabelLinks: vi.fn<typeof Api.useTaskLabelLinks>(),
  useLabelsForTask: vi.fn<typeof Api.useLabelsForTask>(),
  useToggleTaskLabel: vi.fn<typeof Api.useToggleTaskLabel>(),
  useCreateLabel: vi.fn<typeof Api.useCreateLabel>(),
  useUpdateLabel: vi.fn<typeof Api.useUpdateLabel>(),
  useDeleteLabel: vi.fn<typeof Api.useDeleteLabel>(),
});

/** Points the read hooks at fixed data (`undefined` = still loading). */
export function mockLabelData(
  api: typeof Api,
  labels: Label[] | undefined,
  links: TaskLabelLink[] | undefined,
) {
  const map = links ? toTaskLabelMap(links) : undefined;
  vi.mocked(api.useLabels).mockReturnValue({ data: labels } as ReturnType<typeof Api.useLabels>);
  vi.mocked(api.useTaskLabels).mockReturnValue({ data: map } as ReturnType<
    typeof Api.useTaskLabels
  >);
  vi.mocked(api.useTaskLabelLinks).mockReturnValue({ data: links } as ReturnType<
    typeof Api.useTaskLabelLinks
  >);
  vi.mocked(api.useLabelsForTask).mockImplementation((taskId) =>
    labels && map ? labelsForTask(labels, map, taskId) : [],
  );
}
