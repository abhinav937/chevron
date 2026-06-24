import { CloudGrid, CloudGridPoint, Coordinates, GeoBounds, WeatherData, WeatherHour } from '@/types';

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
    'current',
    'cloud_cover,temperature_2m,precipitation,relative_humidity_2m,wind_speed_10m'
  );
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
  const current = data.current ?? {};

  // hourly.time[0] is today 00:00 UTC, so the array contains past hours. Start the
  // forecast at the current hour so "upcoming" precipitation is genuinely ahead.
  const times = hourly.time as string[];
  const nowMs = Date.now();
  let startIdx = times.findIndex(t => new Date(t + 'Z').getTime() >= nowMs);
  if (startIdx < 0) startIdx = 0;

  const forecast: WeatherHour[] = times.slice(startIdx, startIdx + 72).map(
    (time: string, j: number) => {
      const i = startIdx + j;
      return {
        time,
        cloudCover: hourly.cloud_cover[i] ?? 0,
        temperature: hourly.temperature_2m[i] ?? 0,
        precipitation: hourly.precipitation[i] ?? 0,
      };
    }
  );

  // Prefer the live `current` block; fall back to the current-hour slot.
  return {
    cloudCover: current.cloud_cover ?? hourly.cloud_cover[startIdx] ?? 0,
    temperature: current.temperature_2m ?? hourly.temperature_2m[startIdx] ?? 0,
    humidity: current.relative_humidity_2m ?? hourly.relative_humidity_2m[startIdx] ?? 0,
    windSpeed: current.wind_speed_10m ?? hourly.wind_speed_10m[startIdx] ?? 0,
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
 * Samples cloud cover across a dense `steps × steps` grid spanning `bounds`
 * in a SINGLE Open-Meteo request (multi-location coordinates), so the overlay
 * reflects real regional structure (clear vs cloudy areas) for whatever the map
 * is currently showing. Grid rows run south → north (row 0 = southernmost),
 * columns west → east (col 0 = westernmost).
 *
 * Bounds are snapped outward to a coarse lattice so that nearby viewports
 * collapse to the SAME query — combined with an in-memory TTL cache this keeps
 * panning/zooming from hammering Open-Meteo's free tier (HTTP 429).
 */

// Round a span/8-ish value to a "nice" lattice step (deg).
function niceStep(raw: number): number {
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20];
  for (const s of steps) if (raw <= s) return s;
  return 30;
}

interface CachedGrid {
  grid: CloudGrid;
  expires: number;
}
const gridCache = new Map<string, CachedGrid>();
const GRID_TTL_MS = 15 * 60 * 1000; // 15 min — cloud cover doesn't move minute-to-minute

export async function getCloudGrid(bounds: GeoBounds, steps = 10): Promise<CloudGrid> {
  // Clamp to valid / mercator-safe ranges.
  let south = Math.max(-85, Math.min(bounds.south, bounds.north));
  let north = Math.min(85, Math.max(bounds.south, bounds.north));
  let west = Math.max(-180, bounds.west);
  let east = Math.min(180, bounds.east);

  // Snap outward to a lattice keyed to the current span, so a small pan reuses
  // the same query (and cache entry) instead of issuing a fresh API call.
  const snap = niceStep(Math.max(north - south, east - west) / 8);
  south = Math.floor(south / snap) * snap;
  west = Math.floor(west / snap) * snap;
  north = Math.ceil(north / snap) * snap;
  east = Math.ceil(east / snap) * snap;
  south = Math.max(-85, Number(south.toFixed(4)));
  north = Math.min(85, Number(north.toFixed(4)));
  west = Math.max(-180, Number(west.toFixed(4)));
  east = Math.min(180, Number(east.toFixed(4)));
  const safe: GeoBounds = { south, west, north, east };

  const cacheKey = `${south},${west},${north},${east}@${steps}`;
  const now = Date.now();
  const cached = gridCache.get(cacheKey);
  if (cached && cached.expires > now) return cached.grid;

  // Longitude is linear in Web-Mercator, but latitude is NOT. The overlay image
  // is stretched linearly onto the Mercator map, so sample rows evenly in
  // Mercator-Y (not in degrees) — otherwise clouds drift north/south at low
  // zoom and a fixed spot shows different data at different zooms.
  const mercY = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  const invMercY = (y: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

  const yS = mercY(south);
  const yN = mercY(north);
  const lonStep = steps > 1 ? (east - west) / (steps - 1) : 0;
  const lats: number[] = [];
  const lons: number[] = [];

  for (let row = 0; row < steps; row++) {
    const t = steps > 1 ? row / (steps - 1) : 0; // row 0 = south
    const lat = invMercY(yS + (yN - yS) * t);
    for (let col = 0; col < steps; col++) {
      lats.push(Number(lat.toFixed(4)));
      lons.push(Number((west + col * lonStep).toFixed(4)));
    }
  }

  const url = new URL(`${OPEN_METEO_BASE}/forecast`);
  url.searchParams.set('latitude', lats.join(','));
  url.searchParams.set('longitude', lons.join(','));
  url.searchParams.set('current', 'cloud_cover');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) {
    // On rate-limit/error, serve a stale cache entry if we have one.
    if (cached) return cached.grid;
    throw new Error(`Open-Meteo grid error: ${res.status}`);
  }

  // Multi-location responses are an array in the same order as the input coords.
  const data = await res.json();
  const arr: any[] = Array.isArray(data) ? data : [data];

  const points: CloudGridPoint[] = lats.map((lat, i) => ({
    lat,
    lon: lons[i],
    cloudCover: arr[i]?.current?.cloud_cover ?? 0,
  }));

  const grid: CloudGrid = { bounds: safe, steps, points };
  gridCache.set(cacheKey, { grid, expires: now + GRID_TTL_MS });
  // Bound cache size.
  if (gridCache.size > 200) {
    const oldest = gridCache.keys().next().value;
    if (oldest) gridCache.delete(oldest);
  }
  return grid;
}

export function hasUpcomingPrecipitation(forecast: WeatherHour[], hours = 12): boolean {
  return forecast.slice(0, hours).some(h => h.precipitation > 0.1);
}