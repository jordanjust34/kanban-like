import * as RadixDialog from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { overlayClass, stopOverlayKeys } from './overlay';

export const Sheet = RadixDialog.Root;
export const SheetTitle = RadixDialog.Title;
export const SheetDescription = RadixDialog.Description;
export const SheetClose = RadixDialog.Close;

export type SheetContentProps = ComponentProps<typeof RadixDialog.Content> & {
  children: ReactNode;
};

/**
 * Right-side panel (DESIGN §7.4 / §7.7): a floating 480 px sheet from 640 px up, full-screen
 * below. Radix Dialog underneath: Esc closes, focus is trapped and restored, the page behind is
 * inert. Give it a `<SheetTitle>`.
 */
export function SheetContent({ className, children, onKeyDown, ...rest }: SheetContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={cn(overlayClass, 'bg-overlay/60')} />
      <RadixDialog.Content
        onKeyDown={(event) => {
          onKeyDown?.(event);
          stopOverlayKeys(event);
        }}
        className={cn(
          'fixed inset-0 z-50 flex flex-col bg-card outline-none',
          'sm:inset-y-2 sm:right-2 sm:left-auto sm:w-[480px] sm:max-w-[calc(100vw-16px)] sm:rounded-lg sm:shadow-dragging sm:ring-1 sm:ring-black/[0.06]',
          'data-[state=open]:animate-[sheet-in-mobile_200ms_var(--motion-ease)]',
          'data-[state=closed]:animate-[sheet-out-mobile_150ms_ease-in_forwards]',
          'sm:data-[state=open]:animate-[sheet-in_200ms_var(--motion-ease)]',
          'sm:data-[state=closed]:animate-[sheet-out_150ms_ease-in_forwards]',
          className,
        )}
        {...rest}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
