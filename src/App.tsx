import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useApi } from './api/apiContext'
import type { QueryResponse } from './api/types'
import { AnswerPanel } from './features/ask/AnswerPanel'
import { AskForm } from './features/ask/AskForm'
import { RetrievalInspector } from './features/ask/RetrievalInspector'
import { SourcePanel } from './features/ask/SourcePanel'
import { DocumentsPanel } from './features/documents/DocumentsPanel'
import { percent, plural } from './lib/format'

const EXAMPLES = [
  'Why can an inner-product index be used for cosine similarity?',
  'What is recall at k?',
  'What is the capital city of Australia?',
]

function readUrl(): { q: string; k: number } {
  const params = new URLSearchParams(window.location.search)
  const k = Number(params.get('k'))
  return { q: params.get('q') ?? '', k: Number.isInteger(k) && k >= 1 && k <= 10 ? k : 4 }
}

/** Each new question gets its own history entry, so Back and Forward step between questions. */
function writeUrl(q: string | null, k: number) {
  const url = new URL(window.location.href)
  if (q === null) {
    url.searchParams.delete('q')
    url.searchParams.delete('k')
  } else {
    url.searchParams.set('q', q)
    url.searchParams.set('k', String(k))
  }
  if (url.search === window.location.search) return
  const sameQuestion = new URLSearchParams(window.location.search).get('q') === q
  if (sameQuestion) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
}

interface Selection {
  rank: number
  citation: number | null
}

function firstSelection(result: QueryResponse): Selection | null {
  // When the documents don't answer the question, nothing is shown as a source until asked for.
  if (!result.answerable) return null
  const index = result.answer.citations.findIndex((c) => c.found)
  if (index !== -1) return { rank: result.answer.citations[index].rank!, citation: index }
  return result.retrieved.length > 0 ? { rank: result.retrieved[0].rank, citation: null } : null
}

export default function App() {
  const api = useApi()
  const initial = useRef(readUrl()).current
  const [question, setQuestion] = useState(initial.q)
  const [topK, setTopK] = useState(initial.k)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const [answeredVersion, setAnsweredVersion] = useState(0)
  const [showClosest, setShowClosest] = useState(false)
  const [lastAsked, setLastAsked] = useState<{ q: string; k: number } | null>(null)

  const index = useQuery({ queryKey: ['index'], queryFn: () => api.getIndex() })

  const ask = useMutation({
    mutationFn: ({ q, k }: { q: string; k: number }) => api.query(q, k),
    onSuccess: (result) => {
      setSelection(firstSelection(result))
      setShowClosest(false)
      setAnsweredVersion(documentsVersion)
    },
  })

  /** `updateUrl` is false when the address already holds the question (Back, Forward, a shared link). */
  function runQuery(q: string, k: number, updateUrl = true) {
    const trimmed = q.trim()
    if (trimmed.length < 3) return
    setLastAsked({ q: trimmed, k })
    if (updateUrl) writeUrl(trimmed, k)
    ask.mutate({ q: trimmed, k })
  }

  function clear() {
    setQuestion('')
    setSelection(null)
    setLastAsked(null)
    setShowClosest(false)
    ask.reset()
    writeUrl(null, topK)
    document.getElementById('question-input')?.focus()
  }

  // Back and Forward restore the question that was in the address at that point.
  const onPopState = useRef<() => void>(() => {})
  onPopState.current = () => {
    const { q, k } = readUrl()
    setQuestion(q)
    setTopK(k)
    if (q.trim().length >= 3) {
      runQuery(q, k, false)
    } else {
      setSelection(null)
      setLastAsked(null)
      setShowClosest(false)
      ask.reset()
    }
  }
  useEffect(() => {
    const handler = () => onPopState.current()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // A link with ?q=... answers straight away. The ref stops React's dev-mode double effect from asking twice.
  const startedFromUrl = useRef(false)
  useEffect(() => {
    if (startedFromUrl.current) return
    startedFromUrl.current = true
    if (initial.q.trim().length >= 3) runQuery(initial.q, initial.k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const result = ask.data ?? null
  const statementsShown = result !== null && (result.answerable || showClosest)
  const stale = result !== null && answeredVersion !== documentsVersion

  let announcement = ''
  if (ask.isPending) announcement = 'Searching the documents.'
  else if (ask.isError) announcement = `The question could not be answered. ${ask.error.message}`
  else if (result) {
    announcement = result.answerable
      ? `Answer ready: ${plural(result.answer.citations.length, 'statement')}, match confidence ${percent(result.answer.confidence_score)}.`
      : 'The documents do not clearly answer this question.'
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to the question
      </a>

      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[84rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-8">
          <h1 className="text-xl font-semibold">Source-checked Q&amp;A</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {api.mode === 'demo' && (
              <span className="mr-2 rounded bg-warn-bg px-2 py-0.5 font-semibold text-warn">Demo</span>
            )}
            {index.isPending && 'Connecting…'}
            {index.isError && <span className="text-danger">Not connected</span>}
            {index.data &&
              `${api.label} · ${index.data.embedding_model} · ${plural(index.data.documents, 'document')}, ${plural(index.data.chunks, 'passage')}`}
          </p>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[84rem] px-4 py-8 sm:px-8">
        {api.mode === 'demo' && (
          <p className="mb-6 max-w-[70ch] text-sm text-muted">
            This demo runs entirely in your browser on sample documents. It uses simple word matching instead
            of the embedding model the real backend uses, so scores differ. Run the API and set{' '}
            <code>VITE_API_URL</code> to use the real thing.
          </p>
        )}

        {index.isError && (
          <div role="alert" className="mb-6 rounded-md bg-danger-bg px-4 py-3 text-danger">
            <p className="font-semibold">Can’t reach the API</p>
            <p className="text-sm">
              {index.error.message} Start it with <code>docker compose up</code>, or run the app on sample
              data with <code>npm run dev:demo</code>.{' '}
              <button type="button" onClick={() => void index.refetch()} className="font-semibold underline">
                Try again
              </button>
            </p>
          </div>
        )}

        <div className="page">
          <div className="col-main">
          <div className="area-ask">
            <AskForm
              question={question}
              onQuestionChange={setQuestion}
              topK={topK}
              onTopKChange={setTopK}
              onAsk={() => runQuery(question, topK)}
              onClear={clear}
              canClear={question.length > 0 || result !== null || ask.isError}
              pending={ask.isPending}
              examples={EXAMPLES}
              onExample={(example) => {
                setQuestion(example)
                runQuery(example, topK)
              }}
              showExamples={!result && !ask.isPending}
            />
          </div>

          <div className="area-answer min-w-0">
            {ask.isPending && (
              <p className="border-l-4 border-line pl-5 text-muted">
                Searching {index.data ? plural(index.data.chunks, 'passage') : 'the documents'}…
              </p>
            )}

            {ask.isError && !ask.isPending && (
              <div role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-danger">
                <p className="font-semibold">That question couldn’t be answered</p>
                <p className="text-sm">{ask.error.message}</p>
                {lastAsked && (
                  <button
                    type="button"
                    onClick={() => runQuery(lastAsked.q, lastAsked.k)}
                    className="mt-2 text-sm font-semibold underline"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            {result && !ask.isPending && (
              <AnswerPanel
                result={result}
                activeCitation={selection?.citation ?? null}
                onSelectCitation={(i) => {
                  const rank = result.answer.citations[i].rank
                  if (rank !== null) setSelection({ rank, citation: i })
                }}
                stale={stale}
                showClosest={showClosest}
                onToggleClosest={() => setShowClosest((v) => !v)}
                onAskAgain={() => lastAsked && runQuery(lastAsked.q, lastAsked.k)}
              />
            )}

            {!result && !ask.isPending && !ask.isError && (
              <p className="max-w-[60ch] border-l-4 border-line pl-5 text-muted">
                Every statement in an answer is copied from your documents and shown next to its source
                passage, so you can check it instead of trusting it.
              </p>
            )}
          </div>

          {result && !ask.isPending && (
            <div className="area-inspector min-w-0">
              <RetrievalInspector
                result={result}
                totalPassages={index.data?.chunks}
                selectedRank={selection?.rank ?? null}
                statementsShown={statementsShown}
                onSelectRank={(rank) => setSelection({ rank, citation: null })}
              />
            </div>
          )}

          <div className="area-documents min-w-0">
            <DocumentsPanel onChanged={() => setDocumentsVersion((v) => v + 1)} />
          </div>
          </div>

          <div className="col-side">
            <SourcePanel
              result={result}
              selectedRank={selection?.rank ?? null}
              activeCitation={selection?.citation ?? null}
              showMarks={statementsShown}
            />
          </div>
        </div>

        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </main>
    </>
  )
}
