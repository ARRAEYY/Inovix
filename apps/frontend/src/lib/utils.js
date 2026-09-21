import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn() — concatenate + de-duplicate Tailwind classes intelligently.
 * Resolves conflicts (later classes win) using tailwind-merge.
 *
 *   cn('p-4 bg-white', condition && 'bg-card', 'p-6')
 *   → 'bg-card p-6'
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * formatINR — format a number as Indian Rupees (no decimals).
 */
export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

/**
 * formatRelativeTime — "just now", "5m ago", "2h ago", "3d ago", else locale date.
 */
export function formatRelativeTime(date) {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
