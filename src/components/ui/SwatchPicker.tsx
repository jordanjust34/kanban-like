import { Check } from 'lucide-react';
import { SWATCHES } from '@/lib/domain';
import { cn } from '@/lib/cn';

export type SwatchPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  /** Accessible name for the group, e.g. "Label color". */
  label: string;
  className?: string;
};

const NAMES: Record<(typeof SWATCHES)[number], string> = {
  '#E5484D': 'Red',
  '#F76B15': 'Orange',
  '#F5A524': 'Amber',
  '#30A46C': 'Green',
  '#12A594': 'Teal',
  '#3E63DD': 'Blue',
  '#8E4EC6': 'Purple',
  '#D6409F': 'Pink',
};

/** The 8-color palette from DESIGN §6.2 as a radio group (arrow keys move, Space/Enter selects). */
export function SwatchPicker({ value, onChange, label, className }: SwatchPickerProps) {
  const selected = SWATCHES.find((s) => s.toLowerCase() === value.toLowerCase());
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {SWATCHES.map((hex, i) => {
        const checked = hex === selected;
        const tabbable = checked || (!selected && i === 0);
        return (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={NAMES[hex]}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(hex)}
            onKeyDown={(event) => {
              const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
              if (!step) return;
              event.preventDefault();
              const next = SWATCHES[(i + step + SWATCHES.length) % SWATCHES.length]!;
              onChange(next);
              const sibling = event.currentTarget.parentElement?.children[
                SWATCHES.indexOf(next)
              ] as HTMLElement | undefined;
              sibling?.focus();
            }}
            className={cn(
              'flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow duration-150',
              checked ? 'ring-2 ring-[currentColor]' : 'hover:ring-2 hover:ring-black/10',
            )}
            style={{ backgroundColor: hex, color: hex }}
          >
            {checked && <Check aria-hidden className="size-3.5 text-white" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}
