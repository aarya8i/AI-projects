import { z } from 'zod'
import { VERDICTS, type ClaudePlan } from './types.js'

const nonEmpty = z.string().trim().min(1)

export const claudePlanSchema = z.object({
  verdict: z.enum(VERDICTS),
  reason: nonEmpty,
  additionalGear: z.array(z.object({ item: nonEmpty, why: nonEmpty })).max(20),
  risks: z.array(z.object({ title: nonEmpty, detail: nonEmpty, mitigation: nonEmpty })).length(3),
})

export type ParseResult = { ok: true; data: ClaudePlan } | { ok: false; error: string }

/** Removes a ```json ... ``` wrapper if the model added one despite instructions. */
function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim())
  return fenced ? fenced[1] : text.trim()
}

/** Parses and validates Claude's raw text output. Never throws. */
export function parseClaudeResponse(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(stripCodeFence(text))
  } catch {
    return { ok: false, error: 'Model output was not valid JSON.' }
  }
  const result = claudePlanSchema.safeParse(json)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return { ok: false, error: `Model output did not match the expected shape: ${details}` }
  }
  return { ok: true, data: result.data }
}
