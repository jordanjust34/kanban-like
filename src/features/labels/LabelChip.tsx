import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { swatchColors } from '@/lib/swatch';

export type LabelChipProps = {
  name: string;
  color: string;
  /** Picker only: adds a × button. Never pass on the card (it sits inside a `role="button"`). */
  onRemove?: () => void;
  className?: string;
};

const chip =
  'inline-flex h-5 max-w-full items-center rounded-sm px-1.5 text-[12px] leading-4 font-medium';

/** Label chip (DESIGN §6.2): 12 % tint background, AA-readable text in the label's hue. */
export function LabelChip({ name, color, onRemove, className }: LabelChipProps) {
  const { background, text } = swatchColors(color);
  return (
    <span
      className={cn(chip, onRemove && 'pr-0.5', className)}
      style={{ backgroundColor: background, color: text }}
    >
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X aria-hidden className="size-3" strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

/** Neutral "+N" chip for labels that don't fit. */
export function OverflowChip({ count, title }: { count: number; title: string }) {
  return (
    <span title={title} className={cn(chip, 'bg-black/[0.06] text-secondary')}>
      +{count}
    </span>
  );
}
