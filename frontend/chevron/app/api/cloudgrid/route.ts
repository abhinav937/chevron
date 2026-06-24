import { NextRequest, NextResponse } from 'next/server';
import { getCloudGrid } from '@/lib/weather';
import { GeoBounds } from '@/types';

/**
 * Samples a dense cloud-cover grid for arbitrary map bounds, so the cloud
 * overlay can follow the viewport (re-fetched on pan/zoom). One Open-Meteo
 * multi-location call per request.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const b = body?.bounds;

    const south = Number(b?.south);
    const west = Number(b?.west);
    const north = Number(b?.north);
    const east = Number(b?.east);

    if ([south, west, north, east].some(v => !Number.isFinite(v))) {
      return NextResponse.json({ error: 'Invalid bounds' }, { status: 400 });
    }

    const steps = Math.min(12, Math.max(2, Number(body?.steps) || 10));
    const bounds: GeoBounds = { south, west, north, east };
    const grid = await getCloudGrid(bounds, steps);

    return NextResponse.json(grid);
  } catch (error) {
    console.error('Cloud grid API error:', error);
    return NextResponse.json({ error: 'Failed to load cloud grid' }, { status: 500 });
  }
}
