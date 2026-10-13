import { describe, expect, it } from 'vitest'
import { segmentText } from './highlight'

const join = (segments: { text: string }[]) => segments.map((s) => s.text).join('')

describe('segmentText', () => {
  const text = 'One two three four five six.'

  it('returns one plain segment when nothing is marked', () => {
    expect(segmentText(text, [])).toEqual([{ text }])
  })

  it('splits text around a marked range and keeps the id', () => {
    const segments = segmentText(text, [{ start: 4, end: 13, id: 7 }])
    expect(segments).toEqual([{ text: 'One ' }, { text: 'two three', id: 7 }, { text: ' four five six.' }])
  })

  it('handles ranges at the very start and end', () => {
    const segments = segmentText(text, [
      { start: 0, end: 3, id: 0 },
      { start: 24, end: text.length, id: 1 },
    ])
    expect(segments[0]).toEqual({ text: 'One', id: 0 })
    expect(segments.at(-1)).toEqual({ text: 'six.', id: 1 })
    expect(join(segments)).toBe(text)
  })

  it('sorts ranges given out of order', () => {
    const segments = segmentText(text, [
      { start: 14, end: 18, id: 2 },
      { start: 0, end: 3, id: 1 },
    ])
    expect(segments.filter((s) => s.id !== undefined).map((s) => s.id)).toEqual([1, 2])
    expect(join(segments)).toBe(text)
  })

  it('drops a range that overlaps an earlier one instead of duplicating text', () => {
    const segments = segmentText(text, [
      { start: 0, end: 13, id: 1 },
      { start: 8, end: 18, id: 2 },
    ])
    expect(segments.filter((s) => s.id !== undefined)).toHaveLength(1)
    expect(join(segments)).toBe(text)
  })

  it('clamps ranges that run past the text and ignores empty ones', () => {
    const segments = segmentText(text, [
      { start: -5, end: 3, id: 1 },
      { start: 20, end: 999, id: 2 },
      { start: 10, end: 10, id: 3 },
    ])
    expect(segments.map((s) => s.id).filter((id) => id !== undefined)).toEqual([1, 2])
    expect(join(segments)).toBe(text)
  })
})
