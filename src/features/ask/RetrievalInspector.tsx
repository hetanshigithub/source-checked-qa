import type { QueryResponse } from '../../api/types'
import { plural } from '../../lib/format'

interface Props {
  result: QueryResponse
  totalPassages: number | undefined
  selectedRank: number | null
  /** False while the statements are hidden: nothing counts as used yet. */
  statementsShown: boolean
  onSelectRank: (rank: number) => void
}

export function RetrievalInspector({ result, totalPassages, selectedRank, statementsShown, onSelectRank }: Props) {
  const citedBy = (rank: number) => result.answer.citations.filter((c) => c.found && c.rank === rank).length

  return (
    <section aria-labelledby="inspector-heading">
      <h2 id="inspector-heading" className="text-lg font-semibold">
        Retrieval inspector
      </h2>
      <p className="mt-1 text-sm text-muted">
        The {plural(result.retrieved.length, 'passage')} the search returned
        {totalPassages ? ` out of ${totalPassages}` : ''}, best match first. Select a row to read the
        passage.
      </p>

      <div className="relative mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <caption className="sr-only">Passages retrieved for this question</caption>
          <thead>
            <tr className="border-b border-ink text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Rank</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Document</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Passage</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Similarity</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Statements used</th>
              <th scope="col" className="py-2"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {result.retrieved.map((chunk) => {
              const selected = chunk.rank === selectedRank
              const used = statementsShown ? citedBy(chunk.rank) : null
              return (
                <tr key={chunk.rank} className={`border-b border-line ${selected ? 'bg-surface' : ''}`}>
                  <td className="py-2 pr-3 tabular-nums">{chunk.rank}</td>
                  <td className="py-2 pr-3 break-all">{chunk.source_file}</td>
                  <td className="py-2 pr-3 tabular-nums">{chunk.chunk_id}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="h-1.5 w-20 rounded-sm bg-line">
                        <div
                          className="h-full rounded-sm bg-ink"
                          style={{ width: `${Math.min(1, Math.max(0, chunk.score)) * 100}%` }}
                        />
                      </div>
                      <span>{chunk.score.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{used === null ? 'Hidden' : used === 0 ? 'None' : used}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectRank(chunk.rank)}
                      aria-pressed={selected}
                      aria-label={`Read passage ${chunk.chunk_id} from ${chunk.source_file}`}
                      className="font-semibold text-accent underline"
                    >
                      Read
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
