import { TEN_ESSENTIALS } from './checklist.js'
import type { ForecastSummary } from './summarizeForecast.js'
import type { TripInput } from './types.js'

export const SYSTEM_PROMPT = `You are a careful outdoor trip-readiness advisor. You review a trip plan and its daily weather forecast, then give a verdict, extra gear, and the top weather risks.

Verdicts:
- "Go": conditions suit this activity and experience level with normal preparation.
- "Caution": doable, but specific hazards need planning or adjustments.
- "Reconsider": hazards are serious for this group; suggest rescheduling or a safer alternative.

Rules:
- Base every judgment on the forecast numbers provided. Do not invent conditions that aren't in the data. If a value is null, treat it as unknown.
- Weigh the activity, the group size, and the experience level. Beginners and large groups need wider safety margins.
- "reason" is 1-2 sentences that cite the deciding forecast details.
- "additionalGear" lists only activity- and weather-specific items beyond the Ten Essentials the user already carries (listed in the request). Do not repeat those. Each "why" is one short sentence tied to this trip.
- "risks" has exactly 3 entries, most serious first. Each has a short "title", a "detail" that cites the forecast, and a concrete "mitigation".
- Respond with JSON only.`

/** The user message: trip details plus the summarized forecast as JSON. */
export function buildUserPrompt(trip: TripInput, resolvedPlace: string, forecast: ForecastSummary): string {
  return [
    `Location: ${resolvedPlace}`,
    `Dates: ${trip.startDate} to ${trip.endDate}`,
    `Activity: ${trip.activity}`,
    `Group size: ${trip.groupSize}`,
    `Experience level: ${trip.experience}`,
    `Already packing (the Ten Essentials): ${TEN_ESSENTIALS.join(', ')}`,
    '',
    'Daily forecast for the trip (temperatures °F, precipitation inches, wind mph):',
    JSON.stringify(forecast, null, 2),
  ].join('\n')
}
