import { describe, expect, it } from 'vitest'
import { describeWeatherCode, summarizeForecast, type OpenMeteoDaily } from './summarizeForecast.js'

// Trimmed copy of a real Open-Meteo response shape (Fahrenheit, mph, inches).
const fixture: OpenMeteoDaily = {
  daily: {
    time: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'],
    weather_code: [0, 61, 95, 3],
    temperature_2m_max: [62.1, 55.4, 50.2, 58],
    temperature_2m_min: [41.3, 39.9, 35.6, 40.2],
    precipitation_sum: [0, 0.42, 1.1, 0],
    precipitation_probability_max: [5, 70, 90, 10],
    wind_speed_10m_max: [8.1, 14.5, 22.3, 9],
    wind_gusts_10m_max: [15, 28.4, 41.7, 18],
  },
}

describe('summarizeForecast', () => {
  it('keeps only trip days and computes extremes', () => {
    const summary = summarizeForecast(fixture, '2026-10-29', '2026-10-30')
    expect(summary?.days.map((d) => d.date)).toEqual(['2026-10-29', '2026-10-30'])
    expect(summary).toMatchObject({
      highestF: 55.4,
      lowestF: 35.6,
      totalPrecipIn: 1.52,
      maxPrecipChancePct: 90,
      maxWindMph: 22.3,
      maxGustMph: 41.7,
    })
    expect(summary?.days[1]).toEqual({
      date: '2026-10-30',
      conditions: 'Thunderstorm',
      highF: 50.2,
      lowF: 35.6,
      precipIn: 1.1,
      precipChancePct: 90,
      windMph: 22.3,
      gustMph: 41.7,
    })
  })

  it('handles a single-day trip', () => {
    const summary = summarizeForecast(fixture, '2026-10-28', '2026-10-28')
    expect(summary?.days).toHaveLength(1)
    expect(summary?.totalPrecipIn).toBe(0)
  })

  it('ignores null values and reports null when a whole series is missing', () => {
    const withNulls: OpenMeteoDaily = {
      daily: {
        ...fixture.daily,
        temperature_2m_max: [null, 55.4, null, null],
        wind_gusts_10m_max: [null, null, null, null],
        weather_code: [null, 61, 95, 3],
      },
    }
    const summary = summarizeForecast(withNulls, '2026-10-28', '2026-10-29')
    expect(summary?.highestF).toBe(55.4)
    expect(summary?.maxGustMph).toBeNull()
    expect(summary?.days[0].conditions).toBe('Unknown')
  })

  it('returns null when no forecast days fall within the trip', () => {
    expect(summarizeForecast(fixture, '2026-11-05', '2026-11-06')).toBeNull()
  })
})

describe('describeWeatherCode', () => {
  it('maps known codes and falls back to Unknown', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky')
    expect(describeWeatherCode(75)).toBe('Heavy snow')
    expect(describeWeatherCode(42)).toBe('Unknown')
    expect(describeWeatherCode(null)).toBe('Unknown')
  })
})
