/**
 * Fractional ordering within a column (DESIGN §3.3).
 * A dropped card takes the midpoint of its neighbours, so only the moved row is written.
 * When repeated halving exhausts the gap, the column is renumbered in one batch.
 */

/** Gap between consecutive cards after a renumber, and the step used at either end. */
export const POSITION_STEP = 1000;

/** Below this gap the midpoint is no longer trustworthy and the column is renumbered. */
const MIN_GAP = 1e-9;

/**
 * Position for a card placed between `prev` (the card above) and `next` (the card below).
 * Top of a column = `next - 1000`, bottom = `prev + 1000`, empty column = `1000`.
 */
export function positionBetween(prev?: number, next?: number): number {
  if (prev === undefined) return next === undefined ? POSITION_STEP : next - POSITION_STEP;
  if (next === undefined) return prev + POSITION_STEP;
  return (prev + next) / 2;
}

/** True when a card can't be placed strictly between `prev` and `next` any more. */
export function needsRenumber(prev?: number, next?: number): boolean {
  if (prev === undefined || next === undefined) return false;
  const lo = Math.min(prev, next);
  const hi = Math.max(prev, next);
  if (hi - lo < MIN_GAP) return true;
  const mid = (lo + hi) / 2;
  return !(mid > lo && mid < hi);
}

/** New positions 1000, 2000, … for the given (already ordered) cards. Pure. */
export function renumber<T extends { id: string }>(
  ordered: readonly T[],
): { id: string; position: number }[] {
  return ordered.map((task, i) => ({ id: task.id, position: (i + 1) * POSITION_STEP }));
}
