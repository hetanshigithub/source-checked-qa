import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { QueryResponse } from '../../api/types'
import { segmentText } from '../../lib/highlight'

interface Props {
  result: QueryResponse | null
  selectedRank: number | null
  activeCitation: number | null
  /** False while the statements are hidden, so the passage is shown without marks. */
  showMarks: boolean
}

export function SourcePanel({ result, selectedRank, activeCitation, showMarks }: Props) {
  const panel = useRef<HTMLElement>(null)
  const activeMark = useRef<HTMLElement>(null)
  const chunk = result?.retrieved.find((c) => c.rank === selectedRank) ?? null

  // Every statement that came from this passage is marked, the selected one more strongly.
  const segments = useMemo(() => {
    if (!result || !chunk?.text) return []
    const ranges = (showMarks ? result.answer.citations : []).flatMap((c, index) =>
      c.found && c.rank === chunk.rank && c.start !== null && c.end !== null
        ? [{ start: c.start, end: c.end, id: index }]
        : [],
    )
    return segmentText(chunk.text, ranges)
  }, [result, chunk, showMarks])

  useEffect(() => {
    const container = panel.current
    const mark = activeMark.current
    if (!container || !mark) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({
      top: Math.max(0, mark.offsetTop - container.clientHeight / 3),
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [activeCitation, selectedRank, showMarks])

  return (
    <aside
      ref={panel}
      aria-labelledby="source-heading"
      className="relative rounded-sm border border-line bg-surface p-6 shadow-[0_1px_0_var(--line),0_12px_28px_-18px_rgb(23_32_51/0.35)]"
    >
      <h2 id="source-heading" className="text-sm font-semibold text-muted">
        Source passage
      </h2>

      {!chunk && (
        <p className="mt-3 text-base text-muted">
          Select a statement in the answer, or a row in the retrieval inspector, to read the passage it
          comes from.
        </p>
      )}

      {chunk && (
        <>
          <p className="mt-1 text-lg font-semibold break-words">{chunk.source_file}</p>
          <p className="text-sm text-muted">
            Passage {chunk.chunk_id} · retrieved at rank {chunk.rank} · similarity {chunk.score.toFixed(2)}
          </p>
          {chunk.text === null ? (
            <p className="mt-4 text-muted">The text of this passage was not returned.</p>
          ) : (
            <p className="reading mt-4 max-w-[68ch]">
              {segments.map((segment, i) =>
                segment.id === undefined ? (
                  <Fragment key={i}>{segment.text}</Fragment>
                ) : (
                  <Fragment key={i}>
                    <mark
                      className="cite"
                      data-active={segment.id === activeCitation}
                      ref={segment.id === activeCitation ? activeMark : undefined}
                    >
                      {segment.text}
                    </mark>
                    <sup className="ml-0.5 text-xs font-semibold text-accent">{segment.id + 1}</sup>
                  </Fragment>
                ),
              )}
            </p>
          )}
        </>
      )}
    </aside>
  )
}
