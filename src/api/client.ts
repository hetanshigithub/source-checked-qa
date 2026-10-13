import { ApiError } from './types'
import type { Api, DocumentList, IndexInfo, QueryResponse, UploadResponse } from './types'

type Fetch = typeof fetch

/** FastAPI sends `{detail: string}`, or `{detail: [{msg}]}` for validation errors. */
async function readDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: unknown }
        if (typeof first?.msg === 'string') return first.msg
      }
    }
  } catch {
    // Not JSON; fall through to the generic message.
  }
  return `The server answered with status ${response.status}.`
}

export function createLiveApi(baseUrl: string, fetchImpl: Fetch = (...args) => fetch(...args)): Api {
  const root = baseUrl.replace(/\/+$/, '')

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(`${root}${path}`, init)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiError(0, `Can't reach the API at ${root}. Check that it is running.`)
    }
    if (!response.ok) throw new ApiError(response.status, await readDetail(response))
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  return {
    mode: 'live',
    label: root,
    query: (question, topK, signal) =>
      request<QueryResponse>('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, top_k: topK, include_chunks: true }),
        signal,
      }),
    getIndex: () => request<IndexInfo>('/index'),
    listDocuments: () => request<DocumentList>('/documents'),
    uploadDocument: (file) => {
      const body = new FormData()
      body.append('file', file)
      return request<UploadResponse>('/documents', { method: 'POST', body })
    },
    deleteDocument: (name) => request<void>(`/documents/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  }
}
