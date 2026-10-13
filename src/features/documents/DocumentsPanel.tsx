import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useApi } from '../../api/apiContext'
import { formatBytes, plural } from '../../lib/format'
import { UploadZone } from './UploadZone'

interface Props {
  onChanged: () => void
}

export function DocumentsPanel({ onChanged }: Props) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<string | null>(null)

  const documents = useQuery({ queryKey: ['documents'], queryFn: () => api.listDocuments() })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['documents'] })
    void queryClient.invalidateQueries({ queryKey: ['index'] })
    onChanged()
  }

  const remove = useMutation({
    mutationFn: (name: string) => api.deleteDocument(name),
    onSuccess: () => {
      setConfirming(null)
      refresh()
    },
  })

  return (
    <section aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="text-lg font-semibold">
        Documents
      </h2>
      <p className="mt-1 text-sm text-muted">
        Answers are drawn only from these. Adding or removing one rebuilds the search index.
      </p>

      <div className="mt-4">
        <UploadZone
          onUploaded={refresh}
          accept={api.mode === 'demo' ? '.txt' : '.txt,.pdf'}
          hint={api.mode === 'demo' ? '.txt files up to 1 MB.' : '.txt or .pdf, up to 10 MB.'}
        />
      </div>

      {documents.isPending && <p className="mt-4 text-sm text-muted">Loading documents…</p>}
      {documents.isError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {documents.error.message}{' '}
          <button type="button" onClick={() => void documents.refetch()} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}

      {documents.data && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {documents.data.documents.map((doc) => (
            <li key={doc.name} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={doc.name}>
                  {doc.name}
                </p>
                <p className="text-xs text-muted">
                  {doc.origin === 'sample' ? 'Sample' : 'Uploaded'} · {plural(doc.chunks, 'passage')} ·{' '}
                  {formatBytes(doc.size_bytes)}
                </p>
              </div>
              {doc.origin === 'uploaded' &&
                (confirming === doc.name ? (
                  <span className="flex shrink-0 items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => remove.mutate(doc.name)}
                      disabled={remove.isPending}
                      className="font-semibold text-danger underline"
                    >
                      Remove {doc.name}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="underline">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(doc.name)}
                    aria-label={`Remove ${doc.name}`}
                    className="shrink-0 text-sm text-accent underline"
                  >
                    Remove
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
      {remove.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {remove.error.message}
        </p>
      )}
    </section>
  )
}
