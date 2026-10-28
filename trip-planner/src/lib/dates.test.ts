import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isValidIsoDate, todayInTimeZone } from './dates.js'

describe('isValidIsoDate', () => {
  it('accepts real dates, including Feb 29 in a leap year', () => {
    expect(isValidIsoDate('2026-10-28')).toBe(true)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
  })

  it('rejects impossible dates and other formats', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false) // 2026 is not a leap year
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-10-1')).toBe(false)
    expect(isValidIsoDate('10/28/2026')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })
})

describe('addDays / daysBetween', () => {
  it('rolls over months and years', () => {
    expect(addDays('2026-10-28', 15)).toBe('2026-11-12')
    expect(addDays('2026-12-25', 10)).toBe('2027-01-04')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('counts signed days and ignores DST changes', () => {
    expect(daysBetween('2026-10-28', '2026-11-12')).toBe(15)
    expect(daysBetween('2026-11-12', '2026-10-28')).toBe(-15)
    // US DST ends 2026-11-01; date math must still give whole days.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('todayInTimeZone', () => {
  // 2026-10-29 03:00 UTC is still Oct 28 in California but Oct 29 in Tokyo.
  const now = new Date('2026-10-29T03:00:00Z')

  it('uses the given time zone, not UTC', () => {
    expect(todayInTimeZone('America/Los_Angeles', now)).toBe('2026-10-28')
    expect(todayInTimeZone('Asia/Tokyo', now)).toBe('2026-10-29')
    expect(todayInTimeZone('UTC', now)).toBe('2026-10-29')
  })
})
