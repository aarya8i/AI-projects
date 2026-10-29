import { z } from 'zod'
import { VERDICTS, type ModelPlan } from './types.js'

const nonEmpty = z.string().trim().min(1)

export const modelPlanSchema = z.object({
  verdict: z.enum(VERDICTS),
  reason: nonEmpty,
  additionalGear: z.array(z.object({ item: nonEmpty, why: nonEmpty })).max(20),
  risks: z.array(z.object({ title: nonEmpty, detail: nonEmpty, mitigation: nonEmpty })).length(3),
})

// Keywords Cerebras strict mode rejects. The zod schema still enforces them after parsing.
const UNSUPPORTED_KEYWORDS = new Set(['$schema', 'minItems', 'maxItems', 'minLength', 'maxLength'])

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported)
  if (typeof node !== 'object' || node === null) return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (!UNSUPPORTED_KEYWORDS.has(key)) out[key] = stripUnsupported(value)
  }
  if (out.type === 'object') out.additionalProperties = false
  return out
}

/** JSON schema for Cerebras structured output (`strict: true`), derived from modelPlanSchema. */
export function toStrictJsonSchema(): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(modelPlanSchema)) as Record<string, unknown>
}

export type ParseResult = { ok: true; data: ModelPlan } | { ok: false; error: string }

/** Removes a ```json ... ``` wrapper if the model added one despite instructions. */
function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text.trim())
  return fenced ? fenced[1] : text.trim()
}

/** Parses and validates the model's raw text output. Never throws. */
export function parseModelResponse(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(stripCodeFence(text))
  } catch {
    return { ok: false, error: 'Model output was not valid JSON.' }
  }
  const result = modelPlanSchema.safeParse(json)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    return { ok: false, error: `Model output did not match the expected shape: ${details}` }
  }
  return { ok: true, data: result.data }
}
