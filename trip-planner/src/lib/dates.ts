// Calendar-date helpers that work on YYYY-MM-DD strings. They avoid local-time Date
// parsing, which shifts days depending on where the code runs.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/** True if `s` is YYYY-MM-DD and a real calendar date (rejects 2026-02-30). */
export function isValidIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** Days since the Unix epoch. Assumes a valid date. */
function toDayNumber(s: string): number {
  const [y, mo, d] = s.split('-').map(Number)
  return Date.UTC(y, mo - 1, d) / MS_PER_DAY
}

/** Signed number of days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  return toDayNumber(b) - toDayNumber(a)
}

export function addDays(s: string, days: number): string {
  return new Date((toDayNumber(s) + days) * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Today's date (YYYY-MM-DD) in an IANA time zone such as "America/Los_Angeles". */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
