import { describe, expect, it } from 'vitest'
import { formatBytes, percent, percentPair, plural } from './format'

describe('format helpers', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formats whole percentages and plurals', () => {
    expect(percent(0.634)).toBe('63%')
    expect(plural(1, 'passage')).toBe('1 passage')
    expect(plural(3, 'passage')).toBe('3 passages')
  })

  it('adds a decimal only when two different values would look identical', () => {
    expect(percentPair(0.4997, 0.5)).toEqual(['49.97%', '50.00%'])
    expect(percentPair(0.504, 0.5)).toEqual(['50.4%', '50.0%'])
    expect(percentPair(0.55, 0.3)).toEqual(['55%', '30%'])
    expect(percentPair(0.5, 0.5)).toEqual(['50%', '50%'])
  })
})
