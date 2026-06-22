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
