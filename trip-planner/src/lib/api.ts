import type { ErrorCode, ErrorResponse, PlanResponse, TripInput } from './types.js'

export interface FriendlyError {
  title: string
  detail: string
}

export type PlanResult = { ok: true; data: PlanResponse } | { ok: false; error: FriendlyError }

const TITLES: Record<ErrorCode, string> = {
  invalid_input: 'Please check your trip details.',
  dates_out_of_range: 'Those dates are outside the forecast window.',
  location_not_found: "We couldn't find that location.",
  upstream_error: 'A service we rely on is having trouble.',
  server_error: 'Something went wrong on our end.',
}

/** Turns an API error code and message into banner text. */
export function friendlyError(code: ErrorCode | undefined, message: string | undefined): FriendlyError {
  if (code && code in TITLES) return { title: TITLES[code], detail: message ?? '' }
  return { title: 'Something went wrong.', detail: 'Please try again in a moment.' }
}

const NETWORK_ERROR: FriendlyError = {
  title: "Couldn't reach the server.",
  detail: 'Check your connection and try again.',
}

/** POSTs the trip to /api/plan. Never throws; failures come back as friendly errors. */
export async function requestPlan(trip: TripInput): Promise<PlanResult> {
  let res: Response
  try {
    res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(trip),
    })
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, error: friendlyError(undefined, undefined) }
  }

  if (res.ok) return { ok: true, data: body as PlanResponse }
  const err = body as Partial<ErrorResponse>
  return { ok: false, error: friendlyError(err.code, err.error) }
}
