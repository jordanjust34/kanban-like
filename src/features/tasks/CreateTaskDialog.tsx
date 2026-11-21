import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { STATUS_BY_VALUE, type Status } from '@/lib/domain';
import { useCreateTask } from './api';
import { TaskForm, type TaskFormValues } from './TaskForm';

export type CreateTaskDialogProps = {
  open: boolean;
  /** Preset column (from `?new=<status>`). */
  status: Status;
  onClose: () => void;
};

/** Header "New task" dialog with every field (D13). The card appears optimistically. */
export function CreateTaskDialog({ open, status, onClose }: CreateTaskDialogProps) {
  const create = useCreateTask();

  const onSubmit = (values: TaskFormValues) => {
    create(values);
    onClose();
    toast.success('Task created', {
      description: `Added to ${STATUS_BY_VALUE[values.status].label}`,
      duration: 2500,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <div className="flex h-12 shrink-0 items-center px-5 pr-12">
          <DialogTitle className="text-[13px] leading-5 font-medium text-secondary">
            New task
          </DialogTitle>
        </div>
        <TaskForm key={status} initialStatus={status} onSubmit={onSubmit} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}
