import { Coordinates, WeatherData, WeatherHour } from '@/types';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1';

function classifyTransparency(cloudCover: number): WeatherData['transparency'] {
  if (cloudCover <= 10) return 'excellent';
  if (cloudCover <= 25) return 'above_average';
  if (cloudCover <= 50) return 'average';
  if (cloudCover <= 75) return 'below_average';
  return 'poor';
}

export async function getWeatherData(coords: Coordinates): Promise<WeatherData> {
  const url = new URL(`${OPEN_METEO_BASE}/forecast`);
  url.searchParams.set('latitude', coords.lat.toString());
  url.searchParams.set('longitude', coords.lon.toString());
  url.searchParams.set(
    'hourly',
    'cloud_cover,temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m'
  );
  url.searchParams.set('forecast_days', '3');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json();
  const hourly = data.hourly;

  const currentCloudCover: number = hourly.cloud_cover[0] ?? 0;
  const currentTemp: number = hourly.temperature_2m[0] ?? 0;
  const currentHumidity: number = hourly.relative_humidity_2m[0] ?? 0;
  const currentWind: number = hourly.wind_speed_10m[0] ?? 0;

  const forecast: WeatherHour[] = (hourly.time as string[]).slice(0, 72).map(
    (time: string, i: number) => ({
      time,
      cloudCover: hourly.cloud_cover[i] ?? 0,
      temperature: hourly.temperature_2m[i] ?? 0,
      precipitation: hourly.precipitation[i] ?? 0,
    })
  );

  return {
    cloudCover: currentCloudCover,
    transparency: classifyTransparency(currentCloudCover),
    seeing: 2.0, // placeholder — no free seeing API available yet
    temperature: currentTemp,
    humidity: currentHumidity,
    windSpeed: currentWind,
    forecast,
  };
}
