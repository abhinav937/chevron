import { NextRequest, NextResponse } from 'next/server';
import { getLorenzRating } from '@/lib/lorenz';
import { getWeatherData } from '@/lib/weather';
import { getMoonData } from '@/lib/astronomy';
import { InsightsPayload, InsightsRequest } from '@/types';
import { clamp } from '@/lib/utils';

function computeScore(
  cloudCover: number,
  moonIllumination: number,
  bortle: number,
  darkMinutes: number
): number {
  const cloudScore = clamp((100 - cloudCover) / 100, 0, 1) * 40;
  const moonScore = clamp(1 - moonIllumination, 0, 1) * 25;
  const darkScore = clamp((9 - bortle) / 8, 0, 1) * 25;
  const hoursScore = clamp(darkMinutes / 360, 0, 1) * 10; // 6 h = full credit
  return Math.round(cloudScore + moonScore + darkScore + hoursScore);
}

function buildRecommendation(score: number, cloudCover: number): string {
  if (cloudCover > 75) return 'Heavy cloud cover — imaging not recommended tonight.';
  if (score >= 80) return 'Excellent conditions. Get out there.';
  if (score >= 60) return 'Good conditions for most targets.';
  if (score >= 40) return 'Marginal — suitable for bright objects only.';
  return 'Poor conditions — consider a different night or location.';
}

export async function POST(req: NextRequest) {
  const body: InsightsRequest = await req.json();
  const { lat, lon, date } = body;

  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  const coords = { lat, lon };
  const targetDate = date ? new Date(date) : new Date();

  const [lorenz, weather, moon] = await Promise.all([
    getLorenzRating(coords),
    getWeatherData(coords),
    getMoonData(targetDate, coords),
  ]);

  const overallScore = computeScore(
    weather.cloudCover,
    moon.illumination,
    lorenz.bortle,
    moon.darkMinutes
  );

  const payload: InsightsPayload = {
    coordinates: coords,
    timestamp: new Date().toISOString(),
    lorenz,
    weather,
    moon,
    overallScore,
    recommendation: buildRecommendation(overallScore, weather.cloudCover),
  };

  return NextResponse.json(payload);
}
