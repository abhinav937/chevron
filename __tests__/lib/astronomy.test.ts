import { getMoonData } from '@/lib/astronomy';

const NYC = { lat: 40.7128, lon: -74.006 };

describe('getMoonData', () => {
  it('returns a structurally valid MoonData object', async () => {
    const data = await getMoonData(new Date('2024-01-15T00:00:00Z'), NYC);
    expect(typeof data.phase).toBe('string');
    expect(data.phase.length).toBeGreaterThan(0);
    expect(data.illumination).toBeGreaterThanOrEqual(0);
    expect(data.illumination).toBeLessThanOrEqual(1);
    expect(data.darkMinutes).toBeGreaterThanOrEqual(0);
  });

  it('returns Full Moon for Jan 25 2024 (known full moon)', async () => {
    const data = await getMoonData(new Date('2024-01-25T12:00:00Z'), NYC);
    expect(data.phase).toBe('Full Moon');
    expect(data.illumination).toBeGreaterThan(0.9);
  });

  it('returns New Moon for Jan 11 2024 (known new moon)', async () => {
    const data = await getMoonData(new Date('2024-01-11T12:00:00Z'), NYC);
    expect(data.phase).toBe('New Moon');
    expect(data.illumination).toBeLessThan(0.1);
  });

  it('returns no astronomical darkness in midsummer at high latitude (midnight sun)', async () => {
    const tromso = { lat: 69.6, lon: 18.95 };
    const data = await getMoonData(new Date('2024-06-21T00:00:00Z'), tromso);
    expect(data.darkMinutes).toBe(0);
    expect(data.astronomicalDarkStart).toBeNull();
    expect(data.astronomicalDarkEnd).toBeNull();
  });

  it('returns positive darkMinutes for a mid-latitude winter night', async () => {
    const data = await getMoonData(new Date('2024-01-15T00:00:00Z'), NYC);
    expect(data.darkMinutes).toBeGreaterThan(0);
    expect(data.astronomicalDarkStart).not.toBeNull();
    expect(data.astronomicalDarkEnd).not.toBeNull();
  });

  it('returns ISO-formatted timestamps for dark window', async () => {
    const data = await getMoonData(new Date('2024-01-15T00:00:00Z'), NYC);
    if (data.astronomicalDarkStart) {
      expect(new Date(data.astronomicalDarkStart).toISOString()).toBe(data.astronomicalDarkStart);
    }
    if (data.astronomicalDarkEnd) {
      expect(new Date(data.astronomicalDarkEnd).toISOString()).toBe(data.astronomicalDarkEnd);
    }
  });

  it('illumination is higher near full moon than near new moon', async () => {
    const fullMoon = await getMoonData(new Date('2024-01-25T12:00:00Z'), NYC);
    const newMoon = await getMoonData(new Date('2024-01-11T12:00:00Z'), NYC);
    expect(fullMoon.illumination).toBeGreaterThan(newMoon.illumination);
  });
});
