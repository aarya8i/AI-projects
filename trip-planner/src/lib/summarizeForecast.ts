// Turns Open-Meteo's daily forecast into a compact summary for the trip dates only.

/** Daily variables requested from Open-Meteo; the api builds its query from this list. */
export const DAILY_VARIABLES = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
] as const

type Series = (number | null)[]

/** The part of the Open-Meteo forecast response we use. Any value can be null. */
export interface OpenMeteoDaily {
  daily: {
    time: string[]
    weather_code: Series
    temperature_2m_max: Series
    temperature_2m_min: Series
    precipitation_sum: Series
    precipitation_probability_max: Series
    wind_speed_10m_max: Series
    wind_gusts_10m_max: Series
  }
}

export interface DaySummary {
  date: string
  conditions: string
  highF: number | null
  lowF: number | null
  precipIn: number | null
  precipChancePct: number | null
  windMph: number | null
  gustMph: number | null
}

export interface ForecastSummary {
  days: DaySummary[]
  highestF: number | null
  lowestF: number | null
  totalPrecipIn: number | null
  maxPrecipChancePct: number | null
  maxWindMph: number | null
  maxGustMph: number | null
}

// WMO weather interpretation codes, as documented by Open-Meteo.
const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

export function describeWeatherCode(code: number | null): string {
  if (code === null) return 'Unknown'
  return WEATHER_CODES[code] ?? 'Unknown'
}

const nums = (values: Series) => values.filter((v): v is number => v !== null)
const maxOf = (values: Series) => (nums(values).length ? Math.max(...nums(values)) : null)
const minOf = (values: Series) => (nums(values).length ? Math.min(...nums(values)) : null)
const sumOf = (values: Series) =>
  nums(values).length ? Math.round(nums(values).reduce((a, b) => a + b, 0) * 100) / 100 : null

/**
 * Keeps only the days from startDate to endDate (inclusive) and computes trip-wide extremes.
 * Returns null if the forecast has none of the trip days.
 */
export function summarizeForecast(
  forecast: OpenMeteoDaily,
  startDate: string,
  endDate: string,
): ForecastSummary | null {
  const d = forecast.daily
  const at = (series: Series, i: number) => series[i] ?? null

  const days: DaySummary[] = []
  d.time.forEach((date, i) => {
    // YYYY-MM-DD strings compare correctly as plain strings.
    if (date < startDate || date > endDate) return
    days.push({
      date,
      conditions: describeWeatherCode(at(d.weather_code, i)),
      highF: at(d.temperature_2m_max, i),
      lowF: at(d.temperature_2m_min, i),
      precipIn: at(d.precipitation_sum, i),
      precipChancePct: at(d.precipitation_probability_max, i),
      windMph: at(d.wind_speed_10m_max, i),
      gustMph: at(d.wind_gusts_10m_max, i),
    })
  })
  if (days.length === 0) return null

  return {
    days,
    highestF: maxOf(days.map((x) => x.highF)),
    lowestF: minOf(days.map((x) => x.lowF)),
    totalPrecipIn: sumOf(days.map((x) => x.precipIn)),
    maxPrecipChancePct: maxOf(days.map((x) => x.precipChancePct)),
    maxWindMph: maxOf(days.map((x) => x.windMph)),
    maxGustMph: maxOf(days.map((x) => x.gustMph)),
  }
}
