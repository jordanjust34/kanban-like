import { useState } from 'react';
import { isStatus, type Status } from '@/lib/domain';
import { closeOverlay, useSearchParam } from '@/lib/urlState';
import { CreateTaskDialog } from './CreateTaskDialog';
import { TaskDetailSheet } from './TaskDetailSheet';

/**
 * Mounted once in `App`. URL-driven overlays (IMPLEMENTATION_PLAN X4):
 *   ?new=<status>  create dialog preset to that column (unknown values fall back to To Do)
 *   ?task=<id>     task detail sheet
 * Opening pushes a history entry, so Back closes; closing calls `closeOverlay()`.
 *
 * The last value of each param is remembered so the overlay keeps its content while it animates
 * out after the param is gone.
 */
export function TaskSheetHost() {
  const [newParam] = useSearchParam('new');
  const [taskParam] = useSearchParam('task');

  const createOpen = newParam !== null;
  const status: Status | null = createOpen ? (isStatus(newParam) ? newParam : 'todo') : null;
  const [lastStatus, setLastStatus] = useState<Status>('todo');
  if (status && status !== lastStatus) setLastStatus(status);

  const [lastTaskId, setLastTaskId] = useState<string | null>(taskParam);
  if (taskParam && taskParam !== lastTaskId) setLastTaskId(taskParam);
  const taskId = taskParam || lastTaskId;

  return (
    <>
      <CreateTaskDialog open={createOpen} status={status ?? lastStatus} onClose={closeOverlay} />
      {taskId && (
        <TaskDetailSheet open={Boolean(taskParam)} taskId={taskId} onClose={closeOverlay} />
      )}
    </>
  );
}
