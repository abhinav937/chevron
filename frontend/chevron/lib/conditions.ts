import { MoonData, SuggestedOverlays, WeatherData } from '@/types';
import { clamp } from './geo';
import { hasUpcomingPrecipitation } from './weather';

export function computeScore(
  cloudCover: number,
  moonIllumination: number,
  bortle: number,
  darkMinutes: number
): number {
  const cloudScore = clamp((100 - cloudCover) / 100, 0, 1) * 40;
  const moonScore = clamp(1 - moonIllumination, 0, 1) * 25;
  const darkScore = clamp((9 - bortle) / 8, 0, 1) * 25;
  const hoursScore = clamp(darkMinutes / 360, 0, 1) * 10;
  return Math.round(cloudScore + moonScore + darkScore + hoursScore);
}

export function buildRecommendation(score: number, cloudCover: number): string {
  if (cloudCover > 75) return 'Heavy cloud cover — imaging not recommended tonight.';
  if (score >= 80) return 'Excellent conditions. Get out there.';
  if (score >= 60) return 'Good conditions for most targets.';
  if (score >= 40) return 'Marginal — suitable for bright objects only.';
  return 'Poor conditions — consider a different night or location.';
}

export function suggestOverlays(
  weather: WeatherData,
  moon: MoonData,
  _bortle: number
): SuggestedOverlays {
  const precipSoon = hasUpcomingPrecipitation(weather.forecast);
  const regionalClouds = weather.cloudCover > 15;

  return {
    lightPollution: true,
    clouds: regionalClouds || moon.illumination > 0.4,
    precipitation: precipSoon,
  };
}