export interface Range {
  start: number
  end: number
  /** Identifies which citation a range belongs to. */
  id: number
}

export interface Segment {
  text: string
  /** Set on highlighted segments. */
  id?: number
}

/**
 * Split `text` into plain and highlighted segments.
 * Ranges are clamped to the text, sorted, and any range that overlaps an earlier
 * one is dropped, so the segments always join back into the original text.
 */
export function segmentText(text: string, ranges: Range[]): Segment[] {
  const usable = ranges
    .map((r) => ({ ...r, start: Math.max(0, r.start), end: Math.min(text.length, r.end) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const segments: Segment[] = []
  let cursor = 0
  for (const range of usable) {
    if (range.start < cursor) continue
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start) })
    segments.push({ text: text.slice(range.start, range.end), id: range.id })
    cursor = range.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}
