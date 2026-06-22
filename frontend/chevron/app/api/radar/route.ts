import { NextResponse } from 'next/server';
import { fetchLatestRadarFrame } from '@/lib/cloudOverlay';

export async function GET() {
  const frame = await fetchLatestRadarFrame();
  if (!frame) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({ available: true, frame });
}