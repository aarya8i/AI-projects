import { describe, expect, it } from 'vitest'
import { buildUserPrompt } from './prompt.js'
import type { ForecastSummary } from './summarizeForecast.js'

const summary: ForecastSummary = {
  days: [],
  highestF: 61,
  lowestF: 38,
  totalPrecipIn: 0.2,
  maxPrecipChancePct: 40,
  maxWindMph: 12,
  maxGustMph: 20,
}

describe('buildUserPrompt', () => {
  it('includes the trip details, essentials, and forecast', () => {
    const prompt = buildUserPrompt(
      { location: 'zion', startDate: '2026-11-01', endDate: '2026-11-03', activity: 'Backpacking', groupSize: 6, experience: 'Advanced' },
      'Zion National Park, Utah, United States',
      summary,
    )
    expect(prompt).toContain('Location: Zion National Park, Utah, United States')
    expect(prompt).toContain('Dates: 2026-11-01 to 2026-11-03')
    expect(prompt).toContain('Activity: Backpacking')
    expect(prompt).toContain('Group size: 6')
    expect(prompt).toContain('Experience level: Advanced')
    expect(prompt).toContain('Map and compass')
    expect(prompt).toContain('"highestF": 61')
  })
})
