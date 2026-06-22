import { GET } from '@/app/api/moon/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/astronomy', () => ({
  getMoonData: jest.fn().mockResolvedValue({
    phase: 'Waxing Crescent',
    illumination: 0.25,
    riseTime: null,
    setTime: null,
    astronomicalDarkStart: '2024-01-15T23:00:00.000Z',
    astronomicalDarkEnd: '2024-01-16T05:00:00.000Z',
    darkMinutes: 360,
  }),
}));

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/moon');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { url: url.toString() } as unknown as NextRequest;
}

describe('GET /api/moon', () => {
  it('returns 200 with moon data for valid coordinates', async () => {
    const res = await GET(makeRequest({ lat: '40.7128', lon: '-74.006' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.phase).toBe('Waxing Crescent');
    expect(body.illumination).toBe(0.25);
    expect(body.darkMinutes).toBe(360);
  });

  it('accepts an optional date parameter', async () => {
    const res = await GET(makeRequest({ lat: '40.7128', lon: '-74.006', date: '2024-03-20' }));
    expect(res.status).toBe(200);
  });

  it('passes the parsed date to getMoonData', async () => {
    const { getMoonData } = jest.requireMock('@/lib/astronomy');
    await GET(makeRequest({ lat: '40.7128', lon: '-74.006', date: '2024-03-20' }));
    const calledDate: Date = getMoonData.mock.calls.at(-1)[0];
    expect(calledDate.getFullYear()).toBe(2024);
    expect(calledDate.getMonth()).toBe(2); // 0-indexed: March = 2
    expect(calledDate.getDate()).toBe(20);
  });

  it('returns 400 for an invalid date string', async () => {
    const res = await GET(makeRequest({ lat: '40.7128', lon: '-74.006', date: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when lat is missing', async () => {
    const res = await GET(makeRequest({ lon: '-74.006' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when lon is missing', async () => {
    const res = await GET(makeRequest({ lat: '40.7128' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when both params are missing', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
