export interface Coordinates {
  lat: number;
  lon: number;
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
  seeing: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  forecast: WeatherHour[];
}

export interface MoonData {
  phase: string;
  illumination: number;
  riseTime: string | null;
  setTime: string | null;
  astronomicalDarkStart: string | null;
  astronomicalDarkEnd: string | null;
  darkMinutes: number;
}

export interface CloudGridPoint {
  lat: number;
  lon: number;
  cloudCover: number;
}

export interface CloudGrid {
  center: Coordinates;
  spanDeg: number;
  points: CloudGridPoint[];
}

export interface SuggestedOverlays {
  lightPollution: boolean;
  clouds: boolean;
  precipitation: boolean;
}

export interface ConditionsPayload {
  weather: WeatherData;
  moon: MoonData;
  cloudGrid: CloudGrid;
  overallScore: number;
  recommendation: string;
  suggestedOverlays: SuggestedOverlays;
}