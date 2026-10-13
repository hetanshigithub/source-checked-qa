import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { useApi } from '../../api/apiContext'
import { ApiError } from '../../api/types'
import type { UploadResponse } from '../../api/types'
import { plural } from '../../lib/format'

interface Props {
  onUploaded: (response: UploadResponse) => void
  accept: string
  hint: string
}

export function UploadZone({ onUploaded, accept, hint }: Props) {
  const api = useApi()
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  const upload = useMutation<UploadResponse, ApiError | Error, File>({
    mutationFn: (file) => api.uploadDocument(file),
    onSuccess: onUploaded,
  })

  function send(file: File | undefined) {
    if (file) upload.mutate(file)
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    send(event.target.files?.[0])
    event.target.value = '' // lets the same file be chosen again after an error
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    send(event.dataTransfer.files[0])
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`block cursor-pointer rounded-md border-2 border-dashed px-4 py-5 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
          dragging ? 'border-accent bg-surface' : 'border-line'
        }`}
      >
        <span className="block font-semibold text-accent">Add a document</span>
        <span className="mt-1 block text-sm text-muted">Drop a file here or choose one. {hint}</span>
        <input id={inputId} type="file" accept={accept} onChange={onChange} className="sr-only" />
      </label>

      <div aria-live="polite" className="mt-2 min-h-5 text-sm">
        {upload.isPending && <span>Indexing {upload.variables?.name}…</span>}
        {upload.isSuccess && (
          <span>
            Added {upload.data.document.name}: {plural(upload.data.document.chunks, 'passage')}.
          </span>
        )}
        {upload.isError && (
          <span role="alert" className="text-danger">
            {upload.error.message}
          </span>
        )}
      </div>
    </div>
  )
}
