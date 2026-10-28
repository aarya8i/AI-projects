import { describe, expect, it } from 'vitest'
import { mergeChecklist, normalizeItem, TEN_ESSENTIALS } from './checklist.js'

describe('normalizeItem', () => {
  it('ignores case, punctuation, hyphens, extra spaces and simple plurals', () => {
    expect(normalizeItem('First Aid Kits')).toBe(normalizeItem('first-aid kit'))
    expect(normalizeItem('  Water   Bottles ')).toBe(normalizeItem('Water bottle'))
    expect(normalizeItem('Map & Compass')).toBe(normalizeItem('map compass'))
  })

  it('keeps genuinely different items distinct', () => {
    expect(normalizeItem('Rain jacket')).not.toBe(normalizeItem('Rain gear'))
    expect(normalizeItem('Headlamp')).not.toBe(normalizeItem('Flashlight'))
  })

  it('does not strip "ss" endings', () => {
    expect(normalizeItem('Sunglass')).not.toBe(normalizeItem('Sunglas'))
  })
})

describe('mergeChecklist', () => {
  it('starts with the Ten Essentials in order, marked essential', () => {
    const list = mergeChecklist([])
    expect(list).toHaveLength(10)
    expect(list.map((x) => x.item)).toEqual([...TEN_ESSENTIALS])
    expect(list.every((x) => x.essential && x.why === undefined)).toBe(true)
  })

  it('appends additions after the essentials with their reasons', () => {
    const list = mergeChecklist([
      { item: 'Microspikes', why: 'Icy trail above 5,000 ft.' },
      { item: 'Headlamp', why: 'Sunset is at 5:50 PM.' },
    ])
    expect(list.slice(10)).toEqual([
      { item: 'Microspikes', why: 'Icy trail above 5,000 ft.', essential: false },
      { item: 'Headlamp', why: 'Sunset is at 5:50 PM.', essential: false },
    ])
  })

  it('drops additions that duplicate an essential or each other', () => {
    const list = mergeChecklist([
      { item: 'First aid kit', why: 'dup of essential' },
      { item: 'Water Bottles', why: 'dup of essential' },
      { item: 'Trekking poles', why: 'Steep descent.' },
      { item: 'trekking-poles', why: 'dup of addition' },
      { item: '   ', why: 'blank' },
    ])
    expect(list.slice(10).map((x) => x.item)).toEqual(['Trekking poles'])
  })

  it('trims whitespace on kept items', () => {
    const list = mergeChecklist([{ item: '  Gaiters ', why: ' Muddy trail. ' }])
    expect(list[10]).toEqual({ item: 'Gaiters', why: 'Muddy trail.', essential: false })
  })
})
