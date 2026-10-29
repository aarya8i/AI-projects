import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Cerebras SDK: `chat.completions.create` is the only method the handler uses.
const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@cerebras/cerebras_cloud_sdk', () => {
  class APIError extends Error {
    status = 500
  }
  class Cerebras {
    static APIError = APIError
    chat = { completions: { create } }
  }
  return { default: Cerebras }
})

import { POST } from './plan.js'

const trip = {
  location: 'Mount Rainier',
  startDate: '2026-10-30',
  endDate: '2026-10-31',
  activity: 'Day hike',
  groupSize: 3,
  experience: 'Beginner',
}

const geocodeHit = {
  results: [
    { name: 'Mount Rainier', latitude: 46.85, longitude: -121.76, timezone: 'America/Los_Angeles', admin1: 'Washington', country: 'United States' },
  ],
}

const forecast = {
  daily: {
    time: ['2026-10-30', '2026-10-31'],
    weather_code: [61, 3],
    temperature_2m_max: [48.2, 51],
    temperature_2m_min: [33.1, 35.4],
    precipitation_sum: [0.35, 0],
    precipitation_probability_max: [80, 15],
    wind_speed_10m_max: [18.4, 9.2],
    wind_gusts_10m_max: [34, 17.5],
  },
}

const risk = { title: 'Cold rain', detail: '0.35 in of rain at 33-48°F on Oct 30.', mitigation: 'Pack insulated layers.' }
const modelPlan = {
  verdict: 'Caution',
  reason: 'Rain and near-freezing lows on Oct 30 call for extra layers.',
  additionalGear: [
    { item: 'Rain Gear', why: 'Duplicate of an essential; should be dropped.' },
    { item: 'Microspikes', why: 'Trails may ice over near 33°F.' },
  ],
  risks: [risk, risk, risk],
}

/** Shape of a non-streaming Cerebras chat completion. */
function modelReply(content: string | null, finish_reason = 'stop', reasoning = 'Weighing the forecast...') {
  return {
    object: 'chat.completion',
    choices: [{ index: 0, finish_reason, message: { role: 'assistant', content, reasoning } }],
  }
}

/** Routes mocked fetch calls by host. Pass `null` to make that service fail with HTTP 500. */
function mockFetch(geocode: unknown, weather: unknown = forecast) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = new URL(input)
    const body = url.hostname.startsWith('geocoding') ? geocode : weather
    return body === null ? new Response('error', { status: 500 }) : Response.json(body)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  // Fake only Date so AbortSignal.timeout keeps real timers. Oct 28, 11 AM in Washington.
  vi.useFakeTimers({ now: new Date('2026-10-28T18:00:00Z'), toFake: ['Date'] })
  vi.stubEnv('CEREBRAS_API_KEY', 'test-key')
  vi.stubEnv('CEREBRAS_MODEL', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  create.mockReset()
})

describe('POST /api/plan', () => {
  it('returns a plan for a valid trip', async () => {
    const fetchMock = mockFetch(geocodeHit)
    create.mockResolvedValue(modelReply(JSON.stringify(modelPlan)))

    const res = await post(trip)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.verdict).toBe('Caution')
    expect(body.resolvedPlace).toBe('Mount Rainier, Washington, United States')
    expect(body.risks).toHaveLength(3)
    // Ten Essentials first, the duplicate "Rain Gear" dropped, the new item appended.
    expect(body.checklist).toHaveLength(11)
    expect(body.checklist[0]).toEqual({ item: 'Pocketknife', essential: true })
    expect(body.checklist[10]).toEqual({ item: 'Microspikes', why: 'Trails may ice over near 33°F.', essential: false })

    // Forecast requested in US units for exactly the trip dates.
    const forecastUrl = new URL(fetchMock.mock.calls[1][0])
    expect(Object.fromEntries(forecastUrl.searchParams)).toMatchObject({
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      start_date: '2026-10-30',
      end_date: '2026-10-31',
    })

    // Default model, token budget, low reasoning, strict JSON schema; the prompt includes the resolved place.
    const params = create.mock.calls[0][0]
    expect(params.model).toBe('qwen-3.8-27b')
    expect(params.max_completion_tokens).toBe(4096)
    expect(params.reasoning_effort).toBe('low')
    expect(params.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'trip_plan', strict: true } })
    expect(params.messages[0].role).toBe('system')
    expect(params.messages[1].content).toContain('Mount Rainier, Washington, United States')
  })

  it('uses CEREBRAS_MODEL when set', async () => {
    vi.stubEnv('CEREBRAS_MODEL', 'gpt-oss-120b')
    mockFetch(geocodeHit)
    create.mockResolvedValue(modelReply(JSON.stringify(modelPlan)))

    await post(trip)
    expect(create.mock.calls[0][0].model).toBe('gpt-oss-120b')
  })

  it('returns 404 when the location is not found', async () => {
    mockFetch({}) // Open-Meteo omits `results` when nothing matches
    const res = await post(trip)

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'location_not_found' })
    expect(create).not.toHaveBeenCalled()
  })

  it('returns 502 when the model returns output that fails validation', async () => {
    mockFetch(geocodeHit)
    create.mockResolvedValue(modelReply(JSON.stringify({ ...modelPlan, risks: [risk, risk] })))

    const res = await post(trip)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      code: 'upstream_error',
      error: 'The AI returned an unexpected response. Please try again.',
    })
  })

  it('returns 502 when reasoning uses up the token budget (finish_reason "length", no content)', async () => {
    mockFetch(geocodeHit)
    create.mockResolvedValue(modelReply(null, 'length', 'Let me think about the rain on Oct 30...'))

    const res = await post(trip)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ code: 'upstream_error', error: 'The AI response was cut off. Please try again.' })
  })

  it('returns 502 when the answer is cut off mid-JSON', async () => {
    mockFetch(geocodeHit)
    create.mockResolvedValue(modelReply('{"verdict": "Go", "rea', 'length'))

    expect((await post(trip)).status).toBe(502)
  })

  it('returns 502 for empty content and never falls back to the reasoning field', async () => {
    mockFetch(geocodeHit)
    // A valid plan sits in `reasoning`, but only `content` is the answer.
    create.mockResolvedValue(modelReply('   ', 'stop', JSON.stringify(modelPlan)))

    const res = await post(trip)
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ code: 'upstream_error', error: 'The AI returned an empty response. Please try again.' })
  })

  it('returns 502 when the Cerebras API throws', async () => {
    mockFetch(geocodeHit)
    create.mockRejectedValue(new Error('network down'))

    expect((await post(trip)).status).toBe(502)
  })

  it('returns 502 when the weather service fails', async () => {
    mockFetch(geocodeHit, null)
    const res = await post(trip)

    expect(res.status).toBe(502)
    expect((await res.json()).error).toContain('weather service')
  })

  it('returns 400 for invalid input without calling any service', async () => {
    const fetchMock = mockFetch(geocodeHit)
    const res = await post({ ...trip, groupSize: 50 })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid_input', error: 'Group size must be 20 or fewer.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for a malformed JSON body', async () => {
    mockFetch(geocodeHit)
    const res = await post('{not json')
    expect(res.status).toBe(400)
  })

  it('returns 400 when dates are outside the forecast window at the location', async () => {
    mockFetch(geocodeHit)
    const res = await post({ ...trip, startDate: '2026-11-10', endDate: '2026-11-14' })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'dates_out_of_range' })
  })

  it('checks "today" in the location time zone, not UTC', async () => {
    // 03:00 UTC on Oct 29 is still Oct 28 in Washington, so an Oct 28 start is allowed.
    vi.setSystemTime(new Date('2026-10-29T03:00:00Z'))
    mockFetch(geocodeHit, { daily: { ...forecast.daily, time: ['2026-10-28'] } })
    create.mockResolvedValue(modelReply(JSON.stringify(modelPlan)))

    const res = await post({ ...trip, startDate: '2026-10-28', endDate: '2026-10-28' })
    expect(res.status).toBe(200)
  })

  it('returns 500 without calling services when the API key is missing', async () => {
    vi.stubEnv('CEREBRAS_API_KEY', '')
    const fetchMock = mockFetch(geocodeHit)

    const res = await post(trip)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ code: 'server_error' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
