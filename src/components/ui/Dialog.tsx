import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { overlayClass, stopOverlayKeys } from './overlay';

export const Dialog = RadixDialog.Root;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;
export const DialogClose = RadixDialog.Close;

export type DialogContentProps = ComponentProps<typeof RadixDialog.Content> & {
  /** Shows a ghost × in the top-right corner. */
  showClose?: boolean;
  children: ReactNode;
};

/**
 * Centered modal (overlay + portal + focus trap). Give it a `<DialogTitle>`; pass
 * `aria-describedby={undefined}` when there is no description.
 */
export function DialogContent({
  className,
  children,
  showClose = true,
  onKeyDown,
  ...rest
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={overlayClass} />
      <RadixDialog.Content
        onKeyDown={(event) => {
          onKeyDown?.(event);
          stopOverlayKeys(event);
        }}
        className={cn(
          'fixed inset-x-3 top-[max(12px,10vh)] z-50 mx-auto flex max-h-[calc(100dvh-24px)] w-auto max-w-[560px] flex-col',
          'overflow-hidden rounded-lg bg-card shadow-dragging ring-1 ring-black/[0.06] outline-none',
          'data-[state=open]:animate-[dialog-in_200ms_var(--motion-ease)]',
          'data-[state=closed]:animate-[dialog-out_150ms_ease-in_forwards]',
          className,
        )}
        {...rest}
      >
        {children}
        {showClose && (
          // Wrapper does the positioning: Button's own `relative` would win over `absolute`.
          <div className="absolute top-2.5 right-2.5">
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="sm" icon={<X />} aria-label="Close" />
            </RadixDialog.Close>
          </div>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
