import { getLorenzRating } from '@/lib/lorenz';

describe('getLorenzRating', () => {
  it('returns a valid LorenzRating shape', async () => {
    const data = await getLorenzRating({ lat: 40.7128, lon: -74.006 });
    expect(data.bortle).toBeGreaterThanOrEqual(1);
    expect(data.bortle).toBeLessThanOrEqual(9);
    expect(data.sqm).toBeGreaterThan(0);
    expect(data.sqm).toBeLessThan(25);
    expect(typeof data.description).toBe('string');
    expect(data.description.length).toBeGreaterThan(0);
  });

  it('returns consistent results for the same coordinates', async () => {
    const coords = { lat: 35.0, lon: -105.0 };
    const a = await getLorenzRating(coords);
    const b = await getLorenzRating(coords);
    expect(a).toEqual(b);
  });

  // These tests will need updating once real pixel sampling is implemented.
  // They document the expected contract, not the stub value.
  it('returns a lower SQM for higher Bortle class (more light pollution)', async () => {
    const data = await getLorenzRating({ lat: 40.7128, lon: -74.006 });
    // SQM should decrease as Bortle increases
    const expectedSqm: Record<number, number> = {
      1: 21.9, 2: 21.5, 3: 21.3, 4: 20.8,
      5: 20.0, 6: 19.1, 7: 18.0, 8: 17.0, 9: 16.0,
    };
    expect(data.sqm).toBeCloseTo(expectedSqm[data.bortle], 0);
  });
});
