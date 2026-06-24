import { NextRequest, NextResponse } from 'next/server';
import { getMoonData } from '@/lib/astronomy';
import { buildRecommendation, computeScore, suggestOverlays } from '@/lib/conditions';
import { getWeatherData } from '@/lib/weather';
import { ConditionsPayload } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lon = parseFloat(body.lon);
    const bortle = Number(body.bortle ?? 5);
    const dateStr = body.date as string | undefined;

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const coords = { lat, lon };
    const targetDate = dateStr ? new Date(dateStr) : new Date();

    const [weather, moon] = await Promise.all([
      getWeatherData(coords),
      getMoonData(targetDate, coords),
    ]);

    const overallScore = computeScore(
      weather.cloudCover,
      moon.illumination,
      bortle,
      moon.darkMinutes
    );

    const payload: ConditionsPayload = {
      weather,
      moon,
      overallScore,
      recommendation: buildRecommendation(overallScore, weather.cloudCover),
      suggestedOverlays: suggestOverlays(weather, moon, bortle),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Conditions API error:', error);
    return NextResponse.json({ error: 'Failed to load conditions' }, { status: 500 });
  }
}