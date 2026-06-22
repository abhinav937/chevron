import { clamp, degreesToRadians, radiansToDegrees, toJulianDay, isoDateToday, parseLocalDate } from '@/lib/utils';

describe('clamp', () => {
  it('returns value when within range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('clamps to min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps to max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('handles exact boundary values', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('degreesToRadians', () => {
  it('converts 180° to PI', () => expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 5));
  it('converts 0° to 0', () => expect(degreesToRadians(0)).toBe(0));
  it('converts 360° to 2*PI', () => expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 5));
});

describe('radiansToDegrees', () => {
  it('converts PI to 180', () => expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 5));
  it('is the inverse of degreesToRadians', () => {
    expect(radiansToDegrees(degreesToRadians(45))).toBeCloseTo(45, 5);
  });
});

describe('toJulianDay', () => {
  it('returns ~2451545.0 for J2000.0 epoch (Jan 1.5, 2000 UTC)', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    expect(toJulianDay(date)).toBeCloseTo(2451545.0, 1);
  });

  it('returns a value monotonically increasing with time', () => {
    const d1 = new Date('2024-01-01T00:00:00Z');
    const d2 = new Date('2024-01-02T00:00:00Z');
    expect(toJulianDay(d2)).toBeGreaterThan(toJulianDay(d1));
  });
});

describe('isoDateToday', () => {
  it('returns a valid YYYY-MM-DD string', () => {
    expect(isoDateToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches today\'s date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(isoDateToday()).toBe(today);
  });
});

describe('parseLocalDate', () => {
  it('parses a valid date at local midnight (no UTC day-shift)', () => {
    const d = parseLocalDate('2026-06-22');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5); // June (0-indexed)
    expect(d!.getDate()).toBe(22);
    expect(d!.getHours()).toBe(0);
  });

  it('rejects out-of-range months and days', () => {
    expect(parseLocalDate('2026-13-01')).toBeNull();
    expect(parseLocalDate('2026-00-10')).toBeNull();
    expect(parseLocalDate('2026-06-32')).toBeNull();
  });

  it('rejects rollover dates like Feb 30', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull();
  });

  it('rejects malformed strings', () => {
    expect(parseLocalDate('2026-06')).toBeNull();
    expect(parseLocalDate('not-a-date')).toBeNull();
    expect(parseLocalDate('2026/06/22')).toBeNull();
  });
});
