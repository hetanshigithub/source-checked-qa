import { describe, expect, it, vi } from 'vitest'
import { createLiveApi } from './client'
import { ApiError } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('createLiveApi', () => {
  it('posts the question to /query as JSON and trims a trailing slash from the base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ question: 'q' }))
    await createLiveApi('http://api.test/', fetchMock).query('What is recall?', 3)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/query')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ question: 'What is recall?', top_k: 3, include_chunks: true })
  })

  it('uses the server message for a string detail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: 'Index is not ready yet.' }, 503))
    const error = await createLiveApi('http://api.test', fetchMock).getIndex().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 503, message: 'Index is not ready yet.' })
  })

  it('uses the first message of a validation error list', async () => {
    const detail = [{ msg: 'String should have at least 3 characters' }]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail }, 422))
    await expect(createLiveApi('http://api.test', fetchMock).query('hi', 4)).rejects.toMatchObject({
      status: 422,
      message: 'String should have at least 3 characters',
    })
  })

  it('falls back to a generic message when the body is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    await expect(createLiveApi('http://api.test', fetchMock).getIndex()).rejects.toMatchObject({
      status: 502,
      message: 'The server answered with status 502.',
    })
  })

  it('reports an unreachable API with status 0 and the address', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(createLiveApi('http://api.test', fetchMock).getIndex()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('http://api.test'),
    })
  })

  it('lets an aborted request through unchanged so callers can ignore it', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abort)
    await expect(createLiveApi('http://api.test', fetchMock).query('question', 4)).rejects.toBe(abort)
  })

  it('uploads the file as multipart form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ document: {}, index: {} }, 201))
    const file = new File(['hello world'], 'notes.txt', { type: 'text/plain' })
    await createLiveApi('http://api.test', fetchMock).uploadDocument(file)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/documents')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)
    expect(init.headers).toBeUndefined() // the browser sets the multipart boundary itself
  })

  it('encodes the name when deleting and accepts an empty 204 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await expect(createLiveApi('http://api.test', fetchMock).deleteDocument('my notes (1).txt')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/documents/my%20notes%20(1).txt')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })
})
