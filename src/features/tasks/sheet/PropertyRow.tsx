import type { ReactNode } from 'react';

export type PropertyRowProps = {
  label: string;
  icon: ReactNode;
  /** Id of the native control inside, so the label is clickable and announced. */
  htmlFor?: string;
  children: ReactNode;
};

/**
 * One row of the sheet's property grid: muted label column + value column. The row hides itself
 * when its value renders nothing (`has-[>[data-value]:empty]`), so a slot that returns `null`
 * (e.g. `AssigneeField` before P3b) leaves no empty row behind.
 */
export function PropertyRow({ label, icon, htmlFor, children }: PropertyRowProps) {
  const LabelTag = htmlFor ? 'label' : 'span';
  return (
    <div className="grid min-h-9 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 has-[>[data-value]:empty]:hidden">
      <LabelTag
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-[13px] leading-5 text-subtle [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted"
      >
        {icon}
        {label}
      </LabelTag>
      <div data-value className="flex min-w-0 items-center">
        {children}
      </div>
    </div>
  );
}
