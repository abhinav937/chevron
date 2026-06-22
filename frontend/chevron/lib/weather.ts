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

/**
 * Samples cloud cover across a dense `steps × steps` grid centered on `center`
 * in a SINGLE Open-Meteo request (multi-location coordinates), so the overlay
 * reflects real regional structure (clear vs cloudy areas) rather than a few
 * smeared points. Grid rows run south → north (row 0 = southernmost).
 */
export async function getCloudGrid(
  center: Coordinates,
  spanDeg = 5,
  steps = 10
): Promise<CloudGrid> {
  const half = spanDeg / 2;
  const step = steps > 1 ? spanDeg / (steps - 1) : 0;
  const lats: number[] = [];
  const lons: number[] = [];

  for (let row = 0; row < steps; row++) {
    for (let col = 0; col < steps; col++) {
      lats.push(Number((center.lat - half + row * step).toFixed(4)));
      lons.push(Number((center.lon - half + col * step).toFixed(4)));
    }
  }

  const url = new URL(`${OPEN_METEO_BASE}/forecast`);
  url.searchParams.set('latitude', lats.join(','));
  url.searchParams.set('longitude', lons.join(','));
  url.searchParams.set('current', 'cloud_cover');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`Open-Meteo grid error: ${res.status}`);

  // Multi-location responses are an array in the same order as the input coords.
  const data = await res.json();
  const arr: any[] = Array.isArray(data) ? data : [data];

  const points: CloudGridPoint[] = lats.map((lat, i) => ({
    lat,
    lon: lons[i],
    cloudCover: arr[i]?.current?.cloud_cover ?? 0,
  }));

  return { center, spanDeg, points };
}

export function hasUpcomingPrecipitation(forecast: WeatherHour[], hours = 12): boolean {
  return forecast.slice(0, hours).some(h => h.precipitation > 0.1);
}