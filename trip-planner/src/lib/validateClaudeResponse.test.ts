import { describe, expect, it } from 'vitest'
import { parseClaudeResponse } from './validateClaudeResponse.js'

const risk = { title: 'Afternoon storms', detail: '90% chance Thursday.', mitigation: 'Summit by noon.' }
const valid = {
  verdict: 'Caution',
  reason: 'Storms likely on day two.',
  additionalGear: [{ item: 'Trekking poles', why: 'Wet, steep descent.' }],
  risks: [risk, risk, risk],
}

describe('parseClaudeResponse', () => {
  it('accepts valid JSON', () => {
    expect(parseClaudeResponse(JSON.stringify(valid))).toEqual({ ok: true, data: valid })
  })

  it('accepts JSON wrapped in a code fence', () => {
    const fenced = '```json\n' + JSON.stringify(valid, null, 2) + '\n```'
    expect(parseClaudeResponse(fenced)).toEqual({ ok: true, data: valid })
  })

  it('accepts an empty additionalGear list', () => {
    expect(parseClaudeResponse(JSON.stringify({ ...valid, additionalGear: [] })).ok).toBe(true)
  })

  it('rejects non-JSON text', () => {
    expect(parseClaudeResponse('Sure! Here is your plan: ...')).toEqual({
      ok: false,
      error: 'Model output was not valid JSON.',
    })
  })

  it('rejects anything other than exactly 3 risks', () => {
    for (const risks of [[risk, risk], [risk, risk, risk, risk]]) {
      const result = parseClaudeResponse(JSON.stringify({ ...valid, risks }))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('risks')
    }
  })

  it('rejects an unknown verdict', () => {
    const result = parseClaudeResponse(JSON.stringify({ ...valid, verdict: 'Maybe' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('verdict')
  })

  it('rejects missing fields and blank strings', () => {
    const { reason: _reason, ...noReason } = valid
    expect(parseClaudeResponse(JSON.stringify(noReason)).ok).toBe(false)
    expect(parseClaudeResponse(JSON.stringify({ ...valid, reason: '  ' })).ok).toBe(false)
  })

  it('rejects a JSON array or primitive', () => {
    expect(parseClaudeResponse('[]').ok).toBe(false)
    expect(parseClaudeResponse('42').ok).toBe(false)
  })
})
