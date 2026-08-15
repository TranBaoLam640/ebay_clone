import clsx, { type ClassValue } from 'clsx';

/** Merge conditional class names. Thin wrapper over clsx for ergonomics. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
