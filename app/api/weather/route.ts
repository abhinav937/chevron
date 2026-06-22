import { NextRequest, NextResponse } from 'next/server';
import { getWeatherData } from '@/lib/weather';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon query params required' }, { status: 400 });
  }

  const data = await getWeatherData({ lat, lon });
  return NextResponse.json(data);
}
