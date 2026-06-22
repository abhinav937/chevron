export interface Coordinates {
  lat: number;
  lon: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface LorenzRating {
  bortle: number;
  sqm: number; // sky quality in mag/arcsec²
  description: string;
}

export interface WeatherHour {
  time: string;
  cloudCover: number;
  temperature: number;
  precipitation: number;
}

export interface WeatherData {
  cloudCover: number;
  transparency: 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent';
  seeing: number; // arcseconds
  temperature: number;
  humidity: number;
  windSpeed: number;
  forecast: WeatherHour[];
}

export interface MoonData {
  phase: string;
  illumination: number; // 0.0 – 1.0
  riseTime: string | null;
  setTime: string | null;
  astronomicalDarkStart: string | null;
  astronomicalDarkEnd: string | null;
  darkMinutes: number;
}

export interface InsightsPayload {
  coordinates: Coordinates;
  timestamp: string;
  lorenz: LorenzRating;
  weather: WeatherData;
  moon: MoonData;
  overallScore: number; // 0-100 composite
  recommendation: string;
}

export interface InsightsRequest {
  lat: number;
  lon: number;
  date?: string; // ISO date string, defaults to today
}

export interface SavedLocation {
  id: string;
  name: string;
  coordinates: Coordinates;
  notes?: string;
  createdAt: string;
}
