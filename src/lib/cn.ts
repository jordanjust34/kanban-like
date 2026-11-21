import { clsx, type ClassValue } from 'clsx';

/** Join conditional class names. Thin wrapper so call sites don't depend on clsx directly. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
