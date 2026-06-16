/**
 * Geometry for the bottom-dock SplitPanel (AWS Cloudscape SplitPanel feel).
 * Kept in a plain module (no JSX) so it's trivially unit-testable.
 */

/** Smallest usable panel height in px. */
export const MIN_BOTTOM = 160;

/** Keyboard resize steps (px). */
export const STEP_SINGLE = 10;
export const STEP_PAGE = 60;

/** Sensible default panel height for a given container height. */
export function defaultBottomSize(containerHeight: number): number {
  return Math.round(containerHeight / 2);
}

/**
 * Largest the panel may grow to, leaving room for the content above. On very
 * short viewports we still leave a sliver; otherwise reserve ~250px for content.
 */
export function maxBottomSize(containerHeight: number): number {
  return containerHeight < 400 ? Math.max(0, containerHeight - 40) : containerHeight - 250;
}

/** Clamp `value` into [min, max], tolerating an inverted range (min > max). */
export function getLimitedValue(min: number, value: number, max: number): number {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}
