export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function toJulianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function isoDateToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Parses a `YYYY-MM-DD` string as a local-midnight Date, validating ranges and
 * rejecting rollover (e.g. `2026-02-30`). Returns null for malformed input.
 * Local (not UTC) parsing avoids the day shifting backward in negative-offset
 * timezones where `new Date('2026-06-22')` lands on the previous evening.
 */
export function parseLocalDate(dateStr: string): Date | null {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);
  if (![year, month, day].every(Number.isInteger)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}
