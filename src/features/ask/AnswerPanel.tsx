import { useEffect, useRef } from 'react'
import type { QueryResponse } from '../../api/types'
import { plural } from '../../lib/format'
import { ConfidenceMeter } from './ConfidenceMeter'

interface Props {
  result: QueryResponse
  activeCitation: number | null
  onSelectCitation: (index: number) => void
  stale: boolean
  showClosest: boolean
  onToggleClosest: () => void
  onAskAgain: () => void
}

export function AnswerPanel({ result, activeCitation, onSelectCitation, stale, showClosest, onToggleClosest, onAskAgain }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { answer, answerable } = result
  const citations = answer.citations
  const statementsVisible = answerable || showClosest

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [result])

  return (
    <section aria-labelledby="answer-heading" className="border-l-4 border-ink pl-5">
      <h2 id="answer-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
        {answerable ? 'Answer' : 'The documents don’t clearly answer this'}
      </h2>
      <p className="mt-1 text-sm text-muted">
        You asked: <span className="text-ink">{result.question}</span>
      </p>

      {stale && (
        <div role="status" className="mt-4 rounded-md bg-warn-bg px-4 py-3 text-sm text-warn">
          Your documents changed after this answer.{' '}
          <button type="button" onClick={onAskAgain} className="font-semibold underline">
            Ask again
          </button>{' '}
          to check it against the current set.
        </div>
      )}

      <div className="mt-5">
        <ConfidenceMeter value={answer.confidence_score} threshold={result.confidence_threshold} />
      </div>

      {!answerable && (
        <div className="mt-5 text-base">
          <p>
            The retrieved passages match your question weakly. Rephrase it, or add a document that covers
            the topic. The closest passages are listed in the retrieval inspector.
          </p>
          {citations.length > 0 && (
            <button
              type="button"
              onClick={onToggleClosest}
              aria-expanded={showClosest}
              className="mt-3 font-semibold text-accent underline"
            >
              {showClosest ? 'Hide the closest statements' : 'Show the closest statements anyway'}
            </button>
          )}
        </div>
      )}

      {statementsVisible && (
        <ol className="mt-5 space-y-3">
          {citations.map((citation, index) => {
            const active = activeCitation === index
            return (
              <li key={`${index}-${citation.statement.slice(0, 24)}`}>
                <button
                  type="button"
                  onClick={() => citation.found && onSelectCitation(index)}
                  disabled={!citation.found}
                  aria-pressed={active}
                  aria-label={`Statement ${index + 1}. ${citation.statement}${
                    citation.found
                      ? ` Source: ${citation.source_file}.`
                      : ' Source passage not located.'
                  }`}
                  className={`grid w-full grid-cols-[1.75rem_1fr] gap-x-2 rounded-md px-3 py-2 text-left enabled:hover:bg-surface-2 ${
                    active ? 'bg-surface ring-2 ring-accent' : ''
                  }`}
                >
                  <span aria-hidden="true" className="mt-1 text-sm font-semibold text-accent">
                    {index + 1}
                  </span>
                  <span>
                    <span className="reading block">{citation.statement}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {citation.found
                        ? `${citation.source_file}, passage ${citation.chunk_id}`
                        : 'Source passage not located word for word'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {statementsVisible && citations.length > 0 && (
        <p className="mt-4 text-sm text-muted">
          Each statement is copied from the documents. Select one to see it highlighted in its source.
          {' '}Retrieved {plural(result.retrieved.length, 'passage')} in {Math.round(result.latency_ms)} ms.
        </p>
      )}
    </section>
  )
}
