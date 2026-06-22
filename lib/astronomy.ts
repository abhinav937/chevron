import { Coordinates, MoonData } from '@/types';
import { degreesToRadians, radiansToDegrees, toJulianDay } from './utils';

function moonIllumination(jdn: number): { illumination: number; phase: string } {
  const k = (jdn - 2451550.1) / 29.530588853;
  const phase = k - Math.floor(k);
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * phase));

  let phaseName: string;
  if (phase < 0.0625 || phase >= 0.9375) phaseName = 'New Moon';
  else if (phase < 0.1875) phaseName = 'Waxing Crescent';
  else if (phase < 0.3125) phaseName = 'First Quarter';
  else if (phase < 0.4375) phaseName = 'Waxing Gibbous';
  else if (phase < 0.5625) phaseName = 'Full Moon';
  else if (phase < 0.6875) phaseName = 'Waning Gibbous';
  else if (phase < 0.8125) phaseName = 'Last Quarter';
  else phaseName = 'Waning Crescent';

  return { illumination, phase: phaseName };
}

// Approximates astronomical twilight boundaries for a given date + location.
// Returns null start/end when continuous daylight or darkness applies (polar regions).
function astronomicalDarkWindow(
  date: Date,
  coords: Coordinates
): { start: string | null; end: string | null; darkMinutes: number } {
  const lat = degreesToRadians(coords.lat);
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const declination = degreesToRadians(
    -23.45 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365)
  );

  // Hour angle threshold for astronomical twilight (-18° below horizon)
  const cosH =
    (Math.cos(degreesToRadians(108)) - Math.sin(lat) * Math.sin(declination)) /
    (Math.cos(lat) * Math.cos(declination));

  if (cosH < -1) {
    // Midnight sun — no astronomical darkness
    return { start: null, end: null, darkMinutes: 0 };
  }
  if (cosH > 1) {
    // Polar night — always dark
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 0);
    return { start: start.toISOString(), end: end.toISOString(), darkMinutes: 1440 };
  }

  const H = radiansToDegrees(Math.acos(cosH));
  const noonUTC = 12 - coords.lon / 15;
  const startHour = noonUTC + H / 15;
  const endHour = noonUTC + (24 - H / 15);

  const startDate = new Date(date);
  startDate.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
  const endDate = new Date(date);
  endDate.setHours(Math.floor(endHour % 24), Math.round(((endHour % 1) * 60) % 60), 0, 0);

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    darkMinutes: Math.max(0, Math.round((endHour - startHour) * 60)),
  };
}

export async function getMoonData(date: Date, coords: Coordinates): Promise<MoonData> {
  const jdn = toJulianDay(date);
  const { illumination, phase } = moonIllumination(jdn);
  const darkWindow = astronomicalDarkWindow(date, coords);

  return {
    phase,
    illumination,
    riseTime: null,   // TODO: implement rise/set with USNO or similar
    setTime: null,
    astronomicalDarkStart: darkWindow.start,
    astronomicalDarkEnd: darkWindow.end,
    darkMinutes: darkWindow.darkMinutes,
  };
}
