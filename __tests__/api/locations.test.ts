import { GET, POST } from '@/app/api/locations/route';
import type { NextRequest } from 'next/server';

function makePostRequest(body: object): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe('GET /api/locations', () => {
  it('returns 200 with an empty locations array (stub state)', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.locations)).toBe(true);
    expect(body.locations).toHaveLength(0);
  });
});

describe('POST /api/locations', () => {
  it('returns 501 until the database is wired up', async () => {
    const res = await POST(makePostRequest({ name: 'Dark Sky Ranch', lat: 30.0, lon: -100.0 }));
    expect(res.status).toBe(501);
  });
});
