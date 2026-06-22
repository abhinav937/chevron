import { GET } from '@/app/api/weather/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/weather', () => ({
  getWeatherData: jest.fn().mockResolvedValue({
    cloudCover: 30,
    transparency: 'average',
    seeing: 2.0,
    temperature: 10,
    humidity: 70,
    windSpeed: 15,
    forecast: [],
  }),
}));

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/weather');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as NextRequest;
}

describe('GET /api/weather', () => {
  it('returns 200 with weather data for valid coordinates', async () => {
    const res = await GET(makeRequest({ lat: '40.7128', lon: '-74.006' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cloudCover).toBe(30);
    expect(body.transparency).toBe('average');
    expect(body.forecast).toEqual([]);
  });

  it('returns 400 when lat is missing', async () => {
    const res = await GET(makeRequest({ lon: '-74.006' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when lon is missing', async () => {
    const res = await GET(makeRequest({ lat: '40.7128' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when lat is non-numeric', async () => {
    const res = await GET(makeRequest({ lat: 'abc', lon: '-74.006' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when both params are missing', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('passes the parsed coordinates to getWeatherData', async () => {
    const { getWeatherData } = jest.requireMock('@/lib/weather');
    await GET(makeRequest({ lat: '34.05', lon: '-118.24' }));
    expect(getWeatherData).toHaveBeenCalledWith({ lat: 34.05, lon: -118.24 });
  });
});
