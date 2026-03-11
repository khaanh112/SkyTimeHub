/**
 * Compute duration in minutes between two timestamps.
 */
export function computeDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}
