// Shared types for the browser and api/. Keep this file free of runtime dependencies.

export const ACTIVITIES = ['Day hike', 'Backpacking', 'Car camping', 'Trail running'] as const
export type Activity = (typeof ACTIVITIES)[number]

export const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

export const VERDICTS = ['Go', 'Caution', 'Reconsider'] as const
export type Verdict = (typeof VERDICTS)[number]

/** What the browser POSTs to /api/plan. Dates are YYYY-MM-DD. */
export interface TripInput {
  location: string
  startDate: string
  endDate: string
  activity: Activity
  groupSize: number
  experience: ExperienceLevel
}

export interface GearSuggestion {
  item: string
  why: string
}

export interface Risk {
  title: string
  detail: string
  mitigation: string
}

/** The JSON shape the model must return. */
export interface ModelPlan {
  verdict: Verdict
  reason: string
  additionalGear: GearSuggestion[]
  risks: Risk[]
}

export interface ChecklistItem {
  item: string
  /** Why it's on the list; absent for the Ten Essentials. */
  why?: string
  essential: boolean
}

/** Successful response from /api/plan. */
export interface PlanResponse {
  verdict: Verdict
  reason: string
  checklist: ChecklistItem[]
  risks: Risk[]
  resolvedPlace: string
}

/** Error response from /api/plan. `code` lets the UI pick a friendly message. */
export type ErrorCode =
  | 'invalid_input'
  | 'dates_out_of_range'
  | 'location_not_found'
  | 'upstream_error'
  | 'server_error'

export interface ErrorResponse {
  error: string
  code: ErrorCode
}
