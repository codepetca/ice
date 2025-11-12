/**
 * Theme utilities for Ice app
 */

// Utility function to combine class names
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');
}
