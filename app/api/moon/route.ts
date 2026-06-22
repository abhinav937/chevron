import { NextRequest, NextResponse } from 'next/server';
import { getMoonData } from '@/lib/astronomy';
import { isoDateToday, parseLocalDate } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');
  const dateStr = searchParams.get('date') ?? isoDateToday();

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon query params required' }, { status: 400 });
  }

  const date = parseLocalDate(dateStr);
  if (!date) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
  }

  const data = await getMoonData(date, { lat, lon });
  return NextResponse.json(data);
}
