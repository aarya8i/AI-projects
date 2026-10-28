import { describe, expect, it } from 'vitest'
import { checkDates, maxEndDate, validateTripInput } from './validateInput.js'

const valid = {
  location: 'Mount Rainier',
  startDate: '2026-10-30',
  endDate: '2026-11-01',
  activity: 'Day hike',
  groupSize: 4,
  experience: 'Intermediate',
}

describe('validateTripInput', () => {
  it('accepts valid input and trims the location', () => {
    const result = validateTripInput({ ...valid, location: '  Yosemite  ' })
    expect(result).toEqual({ ok: true, data: { ...valid, location: 'Yosemite' } })
  })

  it('rejects a non-object body', () => {
    expect(validateTripInput(null)).toEqual({ ok: false, errors: ['Request body must be a JSON object.'] })
    expect(validateTripInput('hi')).toEqual({ ok: false, errors: ['Request body must be a JSON object.'] })
  })

  it.each([
    [{ location: 'A' }, 'Location must be at least 2 characters.'],
    [{ location: '   A   ' }, 'Location must be at least 2 characters.'],
    [{ location: 'x'.repeat(101) }, 'Location must be 100 characters or fewer.'],
    [{ startDate: '2026-02-30' }, 'Start date must be a real date in YYYY-MM-DD format.'],
    [{ endDate: 'tomorrow' }, 'End date must be a real date in YYYY-MM-DD format.'],
    [{ activity: 'Kayaking' }, 'Activity must be one of: Day hike, Backpacking, Car camping, Trail running.'],
    [{ groupSize: 0 }, 'Group size must be at least 1.'],
    [{ groupSize: 21 }, 'Group size must be 20 or fewer.'],
    [{ groupSize: 2.5 }, 'Group size must be a whole number.'],
    [{ groupSize: '4' }, 'Group size must be a number.'],
    [{ experience: 'Expert' }, 'Experience must be one of: Beginner, Intermediate, Advanced.'],
  ])('rejects %o', (override, message) => {
    const result = validateTripInput({ ...valid, ...override })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContain(message)
  })

  it('reports every missing field', () => {
    const result = validateTripInput({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toHaveLength(6)
  })
})

describe('checkDates', () => {
  const today = '2026-10-28'

  it('allows a trip starting today', () => {
    expect(checkDates(today, today, today)).toEqual({ ok: true })
  })

  it('rejects a start date in the past', () => {
    expect(checkDates('2026-10-27', '2026-10-29', today)).toEqual({
      ok: false,
      error: "Start date can't be in the past (today is 2026-10-28).",
    })
  })

  it('rejects an end date before the start date', () => {
    expect(checkDates('2026-11-02', '2026-11-01', today)).toEqual({
      ok: false,
      error: 'End date must be on or after the start date.',
    })
  })

  it('allows ending on the last forecast day (today + 15)', () => {
    expect(maxEndDate(today)).toBe('2026-11-12')
    expect(checkDates(today, '2026-11-12', today)).toEqual({ ok: true })
  })

  it('rejects ending one day past the forecast window (today + 16)', () => {
    expect(checkDates(today, '2026-11-13', today)).toEqual({
      ok: false,
      error: 'Forecasts only cover the next 16 days, so the trip must end by 2026-11-12.',
    })
  })

  it('handles windows that cross a year boundary', () => {
    expect(checkDates('2026-12-31', '2027-01-04', '2026-12-25')).toEqual({ ok: true })
    expect(checkDates('2026-12-31', '2027-01-10', '2026-12-25').ok).toBe(false)
  })

  it('handles Feb 29 in a leap year', () => {
    expect(checkDates('2028-02-29', '2028-03-01', '2028-02-28')).toEqual({ ok: true })
  })
})
