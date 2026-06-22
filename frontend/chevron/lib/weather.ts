import { CloudGrid, CloudGridPoint, Coordinates, WeatherData, WeatherHour } from '@/types';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';

function classifyTransparency(cloudCover: number): WeatherData['transparency'] {
  if (cloudCover <= 10) return 'excellent';
  if (cloudCover <= 25) return 'above_average';
  if (cloudCover <= 50) return 'average';
  if (cloudCover <= 75) return 'below_average';
  return 'poor';
}

async function fetchHourlyCloud(coords: Coordinates): Promise<{
  cloudCover: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  forecast: WeatherHour[];
}> {
  const url = new URL(`${OPEN_METEO_BASE}/forecast`);
  url.searchParams.set('latitude', coords.lat.toString());
  url.searchParams.set('longitude', coords.lon.toString());
  url.searchParams.set(
    'hourly',
    'cloud_cover,temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m'
  );
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json();
  const hourly = data.hourly;

  const forecast: WeatherHour[] = (hourly.time as string[]).slice(0, 72).map(
    (time: string, i: number) => ({
      time,
      cloudCover: hourly.cloud_cover[i] ?? 0,
      temperature: hourly.temperature_2m[i] ?? 0,
      precipitation: hourly.precipitation[i] ?? 0,
    })
  );

  return {
    cloudCover: hourly.cloud_cover[0] ?? 0,
    temperature: hourly.temperature_2m[0] ?? 0,
    humidity: hourly.relative_humidity_2m[0] ?? 0,
    windSpeed: hourly.wind_speed_10m[0] ?? 0,
    forecast,
  };
}

export async function getWeatherData(coords: Coordinates): Promise<WeatherData> {
  const hourly = await fetchHourlyCloud(coords);

  return {
    cloudCover: hourly.cloudCover,
    transparency: classifyTransparency(hourly.cloudCover),
    seeing: 2.0,
    temperature: hourly.temperature,
    humidity: hourly.humidity,
    windSpeed: hourly.windSpeed,
    forecast: hourly.forecast,
  };
}

export async function getCloudCoverAt(coords: Coordinates): Promise<number> {
  const hourly = await fetchHourlyCloud(coords);
  return hourly.cloudCover;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getCloudGrid(
  center: Coordinates,
  spanDeg = 5,
  steps = 3
): Promise<CloudGrid> {
  const half = spanDeg / 2;
  const step = steps > 1 ? spanDeg / (steps - 1) : 0;
  const coords: Coordinates[] = [];

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      coords.push({
        lat: center.lat - half + row * step,
        lon: center.lon - half + col * step,
      });
    }
  }

  // Batch requests to avoid Open-Meteo 429 rate limits (free tier)
  const points: CloudGridPoint[] = [];
  const batchSize = 3;
  for (let i = 0; i < coords.length; i += batchSize) {
    const batch = coords.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async c => ({
        lat: c.lat,
        lon: c.lon,
        cloudCover: await getCloudCoverAt(c),
      }))
    );
    points.push(...batchResults);
    if (i + batchSize < coords.length) await sleep(250);
  }

  return { center, spanDeg, points };
}

export function hasUpcomingPrecipitation(forecast: WeatherHour[], hours = 12): boolean {
  return forecast.slice(0, hours).some(h => h.precipitation > 0.1);
}