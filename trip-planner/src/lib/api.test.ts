import { afterEach, describe, expect, it, vi } from 'vitest'
import { friendlyError, requestPlan } from './api.js'
import type { TripInput } from './types.js'

const trip: TripInput = {
  location: 'Zion',
  startDate: '2026-10-30',
  endDate: '2026-10-31',
  activity: 'Day hike',
  groupSize: 2,
  experience: 'Beginner',
}

afterEach(() => vi.unstubAllGlobals())

describe('friendlyError', () => {
  it('gives each error code its own title and keeps the server detail', () => {
    expect(friendlyError('location_not_found', 'No match for "Zzz".')).toEqual({
      title: "We couldn't find that location.",
      detail: 'No match for "Zzz".',
    })
    expect(friendlyError('dates_out_of_range', 'x').title).toBe('Those dates are outside the forecast window.')
    expect(friendlyError('upstream_error', 'x').title).toBe('A service we rely on is having trouble.')
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(friendlyError(undefined, undefined).title).toBe('Something went wrong.')
  })
})

describe('requestPlan', () => {
  it('POSTs the trip and returns the plan on success', async () => {
    const plan = { verdict: 'Go', reason: 'Clear.', checklist: [], risks: [], resolvedPlace: 'Zion, Utah, United States' }
    const fetchMock = vi.fn(async () => Response.json(plan))
    vi.stubGlobal('fetch', fetchMock)

    expect(await requestPlan(trip)).toEqual({ ok: true, data: plan })
    expect(fetchMock).toHaveBeenCalledWith('/api/plan', expect.objectContaining({ method: 'POST', body: JSON.stringify(trip) }))
  })

  it('maps an API error response to a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'location_not_found', error: 'Not found.' }, { status: 404 })))
    expect(await requestPlan(trip)).toEqual({
      ok: false,
      error: { title: "We couldn't find that location.", detail: 'Not found.' },
    })
  })

  it('handles network failures and non-JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await requestPlan(trip)).toMatchObject({ ok: false, error: { title: "Couldn't reach the server." } })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    expect(await requestPlan(trip)).toMatchObject({ ok: false, error: { title: 'Something went wrong.' } })
  })
})
