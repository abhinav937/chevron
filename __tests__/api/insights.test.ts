import { POST } from '@/app/api/insights/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/lorenz', () => ({
  getLorenzRating: jest.fn().mockResolvedValue({ bortle: 3, sqm: 21.3, description: 'Rural sky' }),
}));

jest.mock('@/lib/weather', () => ({
  getWeatherData: jest.fn().mockResolvedValue({
    cloudCover: 10,
    transparency: 'excellent',
    seeing: 2.0,
    temperature: 12,
    humidity: 55,
    windSpeed: 8,
    forecast: [],
  }),
}));

jest.mock('@/lib/astronomy', () => ({
  getMoonData: jest.fn().mockResolvedValue({
    phase: 'New Moon',
    illumination: 0.02,
    riseTime: null,
    setTime: null,
    astronomicalDarkStart: '2024-01-15T22:00:00.000Z',
    astronomicalDarkEnd: '2024-01-16T06:00:00.000Z',
    darkMinutes: 480,
  }),
}));

function makeRequest(body: object): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe('POST /api/insights', () => {
  it('returns 200 with a full payload for valid coordinates', async () => {
    const res = await POST(makeRequest({ lat: 40.7128, lon: -74.006 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coordinates).toEqual({ lat: 40.7128, lon: -74.006 });
    expect(body.lorenz.bortle).toBe(3);
    expect(body.weather.cloudCover).toBe(10);
    expect(body.moon.phase).toBe('New Moon');
    expect(body.timestamp).toBeTruthy();
    expect(typeof body.overallScore).toBe('number');
    expect(body.recommendation).toBeTruthy();
  });

  it('overallScore is between 0 and 100', async () => {
    const res = await POST(makeRequest({ lat: 40.7128, lon: -74.006 }));
    const { overallScore } = await res.json();
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
  });

  it('scores high for clear skies + new moon + rural bortle', async () => {
    // cloudCover=10, illumination=0.02, bortle=3, darkMinutes=480
    const res = await POST(makeRequest({ lat: 40.7128, lon: -74.006 }));
    const { overallScore } = await res.json();
    expect(overallScore).toBeGreaterThan(70);
  });

  it('accepts an optional date parameter', async () => {
    const res = await POST(makeRequest({ lat: 40.7128, lon: -74.006, date: '2024-06-15' }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for latitude out of range', async () => {
    const res = await POST(makeRequest({ lat: 999, lon: -74.006 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for longitude out of range', async () => {
    const res = await POST(makeRequest({ lat: 40.7, lon: 999 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when coordinates are missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('recommendation warns about clouds when cloudCover > 75', async () => {
    const { getWeatherData } = jest.requireMock('@/lib/weather');
    getWeatherData.mockResolvedValueOnce({
      cloudCover: 90,
      transparency: 'poor',
      seeing: 2.0,
      temperature: 10,
      humidity: 80,
      windSpeed: 20,
      forecast: [],
    });

    const res = await POST(makeRequest({ lat: 40.7128, lon: -74.006 }));
    const { recommendation } = await res.json();
    expect(recommendation.toLowerCase()).toContain('cloud');
  });
});
