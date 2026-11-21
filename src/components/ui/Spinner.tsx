import { cn } from '@/lib/cn';

type SpinnerProps = {
  /** Pixel size of the spinner. */
  size?: number;
  /** Accessible label. Omit when the spinner sits inside something already labelled. */
  label?: string;
  className?: string;
};

/** Small circular spinner that inherits `currentColor`. */
export function Spinner({ size = 14, label, className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      className={cn('shrink-0 animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
