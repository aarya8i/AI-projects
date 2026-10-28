import { z } from 'zod'
import { addDays, daysBetween, isValidIsoDate } from './dates.js'
import { ACTIVITIES, EXPERIENCE_LEVELS, type TripInput } from './types.js'

/** Open-Meteo forecasts 16 days, counting today. */
export const FORECAST_DAYS = 16

const isoDate = (label: string) =>
  z
    .string({ error: `${label} is required.` })
    .refine(isValidIsoDate, { error: `${label} must be a real date in YYYY-MM-DD format.` })

export const tripInputSchema = z.object({
  location: z
    .string({ error: 'Location is required.' })
    .trim()
    .min(2, { error: 'Location must be at least 2 characters.' })
    .max(100, { error: 'Location must be 100 characters or fewer.' }),
  startDate: isoDate('Start date'),
  endDate: isoDate('End date'),
  activity: z.enum(ACTIVITIES, { error: `Activity must be one of: ${ACTIVITIES.join(', ')}.` }),
  groupSize: z
    .number({ error: 'Group size must be a number.' })
    .int({ error: 'Group size must be a whole number.' })
    .min(1, { error: 'Group size must be at least 1.' })
    .max(20, { error: 'Group size must be 20 or fewer.' }),
  experience: z.enum(EXPERIENCE_LEVELS, {
    error: `Experience must be one of: ${EXPERIENCE_LEVELS.join(', ')}.`,
  }),
})

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: string[] }

/** Checks the shape and field rules. Date range checks need `today`; see checkDates. */
export function validateTripInput(raw: unknown): ValidationResult<TripInput> {
  const result = tripInputSchema.safeParse(raw)
  if (result.success) return { ok: true, data: result.data }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Request body must be a JSON object.'] }
  }
  return { ok: false, errors: result.error.issues.map((issue) => issue.message) }
}

/** The latest end date allowed when it is `today` (YYYY-MM-DD). */
export function maxEndDate(today: string): string {
  return addDays(today, FORECAST_DAYS - 1)
}

/**
 * Checks the trip dates against `today`. Pass today in the trip location's time zone
 * so a user in a later or earlier time zone isn't rejected by the server's UTC clock.
 * Assumes both dates already passed validateTripInput.
 */
export function checkDates(
  startDate: string,
  endDate: string,
  today: string,
): { ok: true } | { ok: false; error: string } {
  const latest = maxEndDate(today)
  if (daysBetween(today, startDate) < 0) {
    return { ok: false, error: `Start date can't be in the past (today is ${today}).` }
  }
  if (daysBetween(startDate, endDate) < 0) {
    return { ok: false, error: 'End date must be on or after the start date.' }
  }
  if (daysBetween(endDate, latest) < 0) {
    return {
      ok: false,
      error: `Forecasts only cover the next ${FORECAST_DAYS} days, so the trip must end by ${latest}.`,
    }
  }
  return { ok: true }
}
