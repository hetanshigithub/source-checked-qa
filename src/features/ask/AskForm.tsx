import { useId } from 'react'
import type { FormEvent } from 'react'

interface Props {
  question: string
  onQuestionChange: (value: string) => void
  topK: number
  onTopKChange: (value: number) => void
  onAsk: () => void
  pending: boolean
  examples: string[]
  onExample: (question: string) => void
  showExamples: boolean
}

export function AskForm({
  question,
  onQuestionChange,
  topK,
  onTopKChange,
  onAsk,
  pending,
  examples,
  onExample,
  showExamples,
}: Props) {
  const inputId = useId()
  const kId = useId()
  const canAsk = question.trim().length >= 3 && !pending

  function submit(event: FormEvent) {
    event.preventDefault()
    if (canAsk) onAsk()
  }

  return (
    <form role="search" onSubmit={submit} aria-label="Ask a question">
      <label htmlFor={inputId} className="block text-sm font-semibold">
        Your question
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="text"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="What do the documents say about…"
          maxLength={1000}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-4 py-3 text-lg placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!canAsk}
          className="rounded-md bg-ink px-6 py-3 text-lg font-semibold text-bg enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Searching…' : 'Ask'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor={kId} className="text-muted">
            Passages to retrieve
          </label>
          <select
            id={kId}
            value={topK}
            onChange={(e) => onTopKChange(Number(e.target.value))}
            className="rounded border border-line bg-surface px-2 py-1"
          >
            {[2, 3, 4, 6, 8, 10].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        {showExamples && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Try:</span>
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onExample(example)}
                className="rounded-full border border-line bg-surface px-3 py-1 text-accent hover:border-accent"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  )
}
