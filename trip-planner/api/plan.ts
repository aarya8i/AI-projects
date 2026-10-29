// POST /api/plan: the only endpoint the browser calls.
// Flow: validate → geocode → date check in the place's time zone → forecast → summarize
//       → Cerebras model → validate model output → merge checklist → respond.
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import { z } from 'zod'
import { mergeChecklist } from '../src/lib/checklist.js'
import { todayInTimeZone } from '../src/lib/dates.js'
import { buildUserPrompt, SYSTEM_PROMPT } from '../src/lib/prompt.js'
import { DAILY_VARIABLES, summarizeForecast, type OpenMeteoDaily } from '../src/lib/summarizeForecast.js'
import type { ErrorCode, ErrorResponse, PlanResponse } from '../src/lib/types.js'
import { checkDates, validateTripInput } from '../src/lib/validateInput.js'
import { parseModelResponse, toStrictJsonSchema } from '../src/lib/validateModelResponse.js'

const DEFAULT_MODEL = 'qwen-3.8-27b'
// Reasoning tokens count toward this limit, so it must cover reasoning plus the ~600-900 token JSON answer.
const MAX_COMPLETION_TOKENS = 4096
const REASONING_EFFORT = 'low'
const FETCH_TIMEOUT_MS = 10_000

const geocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string(),
        admin1: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
})

const series = z.array(z.number().nullable())
const forecastSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    weather_code: series,
    temperature_2m_max: series,
    temperature_2m_min: series,
    precipitation_sum: series,
    precipitation_probability_max: series,
    wind_speed_10m_max: series,
    wind_gusts_10m_max: series,
  }),
})

function json(status: number, body: PlanResponse | ErrorResponse): Response {
  return Response.json(body, { status })
}

function fail(status: number, code: ErrorCode, error: string): Response {
  return json(status, { error, code })
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail(400, 'invalid_input', 'Request body must be valid JSON.')
  }

  const input = validateTripInput(body)
  if (!input.ok) return fail(400, 'invalid_input', input.errors.join(' '))
  const trip = input.data

  // Read only here, on the server. Never log it.
  const apiKey = process.env.CEREBRAS_API_KEY
  if (!apiKey) {
    console.error('CEREBRAS_API_KEY is not set')
    return fail(500, 'server_error', 'The server is not configured correctly. Please try again later.')
  }

  // 1. Geocode: take the first match.
  let place: NonNullable<z.infer<typeof geocodeSchema>['results']>[number] | undefined
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.search = new URLSearchParams({ name: trip.location, count: '1', language: 'en', format: 'json' }).toString()
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Geocoding returned HTTP ${res.status}`)
    place = geocodeSchema.parse(await res.json()).results?.[0]
  } catch (err) {
    console.error('Geocoding failed:', err instanceof Error ? err.message : err)
    return fail(502, 'upstream_error', 'The location service is unavailable right now. Please try again.')
  }
  if (!place) {
    return fail(
      404,
      'location_not_found',
      `We couldn't find "${trip.location}". Try a nearby town, park, or a more general name.`,
    )
  }
  const resolvedPlace = [place.name, place.admin1, place.country].filter(Boolean).join(', ')

  // 2. Dates are checked against today at the trip location, not the server's UTC date.
  const dates = checkDates(trip.startDate, trip.endDate, todayInTimeZone(place.timezone))
  if (!dates.ok) return fail(400, 'dates_out_of_range', dates.error)

  // 3. Forecast for exactly the trip dates.
  let forecast: OpenMeteoDaily
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      daily: DAILY_VARIABLES.join(','),
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      start_date: trip.startDate,
      end_date: trip.endDate,
    }).toString()
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`Forecast returned HTTP ${res.status}`)
    forecast = forecastSchema.parse(await res.json())
  } catch (err) {
    console.error('Forecast failed:', err instanceof Error ? err.message : err)
    return fail(502, 'upstream_error', 'The weather service is unavailable right now. Please try again.')
  }
  const summary = summarizeForecast(forecast, trip.startDate, trip.endDate)
  if (!summary) {
    return fail(502, 'upstream_error', 'The weather service returned no forecast for those dates.')
  }

  // 4. Ask the model. Strict JSON schema output constrains the shape; zod still has the final say.
  let text: string
  try {
    const client = new Cerebras({ apiKey, timeout: 60_000, maxRetries: 1 })
    const completion = await client.chat.completions.create({
      model: process.env.CEREBRAS_MODEL || DEFAULT_MODEL,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      reasoning_effort: REASONING_EFFORT,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'trip_plan', strict: true, schema: toStrictJsonSchema() },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(trip, resolvedPlace, summary) },
      ],
    })
    if (!('object' in completion) || completion.object !== 'chat.completion') {
      throw new Error('Unexpected response type from Cerebras')
    }
    const choice = completion.choices[0]
    if (choice?.finish_reason === 'length') {
      // Reasoning tokens used up the budget before (or during) the answer.
      console.error('Model response hit max_completion_tokens')
      return fail(502, 'upstream_error', 'The AI response was cut off. Please try again.')
    }
    if (choice?.finish_reason === 'content_filter') {
      return fail(502, 'upstream_error', 'The AI declined to assess this trip. Please check official conditions instead.')
    }
    // Only the final answer. The separate `reasoning` field is never read.
    text = choice?.message.content?.trim() ?? ''
    if (!text) {
      console.error('Model returned empty content')
      return fail(502, 'upstream_error', 'The AI returned an empty response. Please try again.')
    }
  } catch (err) {
    if (err instanceof Cerebras.APIError) {
      console.error(`Cerebras API error ${err.status}:`, err.message)
    } else {
      console.error('Cerebras request failed:', err instanceof Error ? err.message : err)
    }
    return fail(502, 'upstream_error', 'The AI service is unavailable right now. Please try again.')
  }

  // 5. Validate the model output before trusting it.
  const plan = parseModelResponse(text)
  if (!plan.ok) {
    console.error('Invalid model output:', plan.error)
    return fail(502, 'upstream_error', 'The AI returned an unexpected response. Please try again.')
  }

  return json(200, {
    verdict: plan.data.verdict,
    reason: plan.data.reason,
    checklist: mergeChecklist(plan.data.additionalGear),
    risks: plan.data.risks,
    resolvedPlace,
  })
}
