import * as RadixPopover from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

export type PopoverContentProps = ComponentProps<typeof RadixPopover.Content>;

/**
 * Floating panel on the card surface (portalled). Label it with `aria-label` or
 * `aria-labelledby`; Radix gives it `role="dialog"`, traps nothing and closes on Esc / outside click.
 */
export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  collisionPadding = 8,
  ...rest
}: PopoverContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-50 min-w-48 rounded-md border border-border bg-card p-1 text-[13px] leading-5 text-primary shadow-popover outline-none',
          'max-h-(--radix-popover-content-available-height) overflow-y-auto scrollbar-thin',
          'origin-(--radix-popover-content-transform-origin) transition-[opacity,scale] duration-150 ease-out',
          'starting:scale-95 starting:opacity-0',
          className,
        )}
        {...rest}
      />
    </RadixPopover.Portal>
  );
}
