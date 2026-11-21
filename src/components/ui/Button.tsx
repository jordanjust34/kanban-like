import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

type CommonProps = Omit<ComponentProps<'button'>, 'children'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets `aria-busy`. Width is preserved. */
  loading?: boolean;
};

type TextButtonProps = CommonProps & {
  children: ReactNode;
  /** Optional icon shown before the text (e.g. `<Plus />`). */
  leadingIcon?: ReactNode;
  icon?: never;
};

type IconButtonProps = CommonProps & {
  /** Icon-only button: an accessible name is required. */
  icon: ReactNode;
  'aria-label': string;
  children?: never;
  leadingIcon?: never;
};

export type ButtonProps = TextButtonProps | IconButtonProps;

const base =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ' +
  'disabled:cursor-not-allowed [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent shadow-[0_1px_2px_rgb(0_0_0/0.10),inset_0_1px_0_rgb(255_255_255/0.12)] ' +
    'enabled:hover:bg-accent-hover enabled:active:bg-accent-hover',
  secondary:
    'border border-border bg-card text-primary shadow-card ' +
    'enabled:hover:border-border-strong enabled:hover:bg-hover',
  ghost: 'text-secondary enabled:hover:bg-black/5 enabled:hover:text-primary',
  danger:
    'bg-danger-strong text-white shadow-[0_1px_2px_rgb(0_0_0/0.10)] enabled:hover:brightness-95',
};

const sizes: Record<ButtonSize, { text: string; icon: string; glyph: number }> = {
  sm: {
    text: 'h-7 px-2.5 text-[13px] leading-5 [&_svg]:size-3.5',
    icon: 'size-7 [&_svg]:size-3.5',
    glyph: 14,
  },
  md: {
    text: 'h-8 px-3 text-[13px] leading-5 [&_svg]:size-4',
    icon: 'size-8 [&_svg]:size-4',
    glyph: 16,
  },
};

export function Button(props: ButtonProps) {
  const {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled,
    className,
    type = 'button',
    icon,
    leadingIcon,
    children,
    ...rest
  } = props;
  const s = sizes[size];
  const iconOnly = icon !== undefined;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        variants[variant],
        iconOnly ? s.icon : s.text,
        disabled && !loading && 'opacity-50',
        loading && 'cursor-progress',
        className,
      )}
      {...rest}
    >
      {iconOnly ? (
        loading ? (
          <Spinner size={s.glyph} />
        ) : (
          icon
        )
      ) : (
        <>
          {loading ? <Spinner size={s.glyph - 2} /> : leadingIcon}
          {children}
        </>
      )}
    </button>
  );
}
