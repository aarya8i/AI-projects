import { describe, expect, it } from 'vitest'
import { parseModelResponse, toStrictJsonSchema } from './validateModelResponse.js'

const risk = { title: 'Afternoon storms', detail: '90% chance Thursday.', mitigation: 'Summit by noon.' }
const valid = {
  verdict: 'Caution',
  reason: 'Storms likely on day two.',
  additionalGear: [{ item: 'Trekking poles', why: 'Wet, steep descent.' }],
  risks: [risk, risk, risk],
}

describe('parseModelResponse', () => {
  it('accepts valid JSON', () => {
    expect(parseModelResponse(JSON.stringify(valid))).toEqual({ ok: true, data: valid })
  })

  it('accepts JSON wrapped in a code fence', () => {
    const fenced = '```json\n' + JSON.stringify(valid, null, 2) + '\n```'
    expect(parseModelResponse(fenced)).toEqual({ ok: true, data: valid })
  })

  it('accepts an empty additionalGear list', () => {
    expect(parseModelResponse(JSON.stringify({ ...valid, additionalGear: [] })).ok).toBe(true)
  })

  it('rejects non-JSON text', () => {
    expect(parseModelResponse('Sure! Here is your plan: ...')).toEqual({
      ok: false,
      error: 'Model output was not valid JSON.',
    })
  })

  it('rejects anything other than exactly 3 risks', () => {
    for (const risks of [[risk, risk], [risk, risk, risk, risk]]) {
      const result = parseModelResponse(JSON.stringify({ ...valid, risks }))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('risks')
    }
  })

  it('rejects an unknown verdict', () => {
    const result = parseModelResponse(JSON.stringify({ ...valid, verdict: 'Maybe' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('verdict')
  })

  it('rejects missing fields and blank strings', () => {
    const { reason: _reason, ...noReason } = valid
    expect(parseModelResponse(JSON.stringify(noReason)).ok).toBe(false)
    expect(parseModelResponse(JSON.stringify({ ...valid, reason: '  ' })).ok).toBe(false)
  })

  it('rejects a JSON array or primitive', () => {
    expect(parseModelResponse('[]').ok).toBe(false)
    expect(parseModelResponse('42').ok).toBe(false)
  })
})

describe('toStrictJsonSchema', () => {
  const schema = toStrictJsonSchema()
  const text = JSON.stringify(schema)

  it('omits keywords Cerebras strict mode rejects', () => {
    for (const keyword of ['$schema', 'minItems', 'maxItems', 'minLength', 'maxLength']) {
      expect(text).not.toContain(`"${keyword}"`)
    }
  })

  it('sets additionalProperties: false on every object', () => {
    const objects: Record<string, unknown>[] = []
    const walk = (node: unknown) => {
      if (typeof node !== 'object' || node === null) return
      if ((node as Record<string, unknown>).type === 'object') objects.push(node as Record<string, unknown>)
      Object.values(node).forEach(walk)
    }
    walk(schema)
    expect(objects).toHaveLength(3) // root, gear item, risk
    expect(objects.every((o) => o.additionalProperties === false)).toBe(true)
  })

  it('keeps the verdict enum and required fields', () => {
    expect(schema).toMatchObject({
      type: 'object',
      required: ['verdict', 'reason', 'additionalGear', 'risks'],
      properties: { verdict: { enum: ['Go', 'Caution', 'Reconsider'] } },
    })
  })
})
