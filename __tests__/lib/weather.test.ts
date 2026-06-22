import { getWeatherData } from '@/lib/weather';

function makeHourlyBlock(cloudCover: number, overrides: Record<string, number[]> = {}) {
  const times = Array.from({ length: 72 }, (_, i) =>
    `2024-01-15T${String(i % 24).padStart(2, '0')}:00`
  );
  return {
    time: times,
    cloud_cover: Array(72).fill(cloudCover),
    temperature_2m: Array(72).fill(15),
    precipitation: Array(72).fill(0),
    relative_humidity_2m: Array(72).fill(60),
    wind_speed_10m: Array(72).fill(10),
    ...overrides,
  };
}

function mockFetch(hourly: ReturnType<typeof makeHourlyBlock>) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ hourly }),
  } as unknown as Response);
}

afterEach(() => jest.restoreAllMocks());

describe('getWeatherData', () => {
  it('returns a valid WeatherData shape', async () => {
    mockFetch(makeHourlyBlock(20));
    const data = await getWeatherData({ lat: 40.7128, lon: -74.006 });

    expect(data.cloudCover).toBe(20);
    expect(data.temperature).toBe(15);
    expect(data.humidity).toBe(60);
    expect(data.windSpeed).toBe(10);
    expect(data.forecast).toHaveLength(72);
    expect(['poor', 'below_average', 'average', 'above_average', 'excellent']).toContain(
      data.transparency
    );
  });

  it.each([
    [5, 'excellent'],
    [20, 'above_average'],
    [40, 'average'],
    [70, 'below_average'],
    [90, 'poor'],
  ])('%d%% cloud cover → transparency "%s"', async (cloudCover, expected) => {
    mockFetch(makeHourlyBlock(cloudCover));
    const data = await getWeatherData({ lat: 40.7128, lon: -74.006 });
    expect(data.transparency).toBe(expected);
  });

  it('forecast entries contain required fields', async () => {
    mockFetch(makeHourlyBlock(10));
    const data = await getWeatherData({ lat: 40.7128, lon: -74.006 });
    const first = data.forecast[0];
    expect(first).toHaveProperty('time');
    expect(first).toHaveProperty('cloudCover');
    expect(first).toHaveProperty('temperature');
    expect(first).toHaveProperty('precipitation');
  });

  it('throws when Open-Meteo returns a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);
    await expect(getWeatherData({ lat: 40.7128, lon: -74.006 })).rejects.toThrow(
      'Open-Meteo error: 503'
    );
  });

  it('calls Open-Meteo with the correct coordinates', async () => {
    mockFetch(makeHourlyBlock(0));
    await getWeatherData({ lat: 34.05, lon: -118.24 });
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('latitude=34.05');
    expect(calledUrl).toContain('longitude=-118.24');
  });

  it('requests a 3-day forecast', async () => {
    mockFetch(makeHourlyBlock(0));
    await getWeatherData({ lat: 40.7128, lon: -74.006 });
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('forecast_days=3');
  });
});
