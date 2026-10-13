import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/types'
import { chunkText, createDemoApi, DEMO_THRESHOLD, locateCitations, splitSentences, tokenize } from './engine'
import { sampleTexts } from './samples'
import questions from '../test/evalQuestions.json'

const freshApi = () => createDemoApi(sampleTexts)

describe('text helpers', () => {
  it('drops stop words and short words when tokenizing', () => {
    expect(tokenize('What is the recall at k for a RAG system?')).toEqual(['recall', 'rag', 'system'])
  })

  it('chunks 180 words at a time with 35 words of overlap', () => {
    const words = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ')
    const chunks = chunkText(words)
    expect(chunks.map((c) => c.split(' ').length)).toEqual([180, 180, 110])
    expect(chunks[1].split(' ')[0]).toBe('w145')
  })

  it('keeps only sentences of at least six words', () => {
    expect(splitSentences('Too short. This sentence has plenty of words in it. Also short!')).toEqual([
      'This sentence has plenty of words in it.',
    ])
  })
})

describe('locateCitations', () => {
  const chunk = { rank: 1, source_file: 'a.txt', chunk_id: 9, text: 'Intro words here. The index is kept in memory.' }

  it('returns the exact character range of the statement', () => {
    const [c] = locateCitations(['The index is kept in memory.'], [chunk])
    expect(c.found).toBe(true)
    expect(chunk.text.slice(c.start!, c.end!)).toBe('The index is kept in memory.')
  })

  it('matches a statement whose final period was added by the generator', () => {
    const cut = { ...chunk, text: 'Start. The index is kept in memory' }
    const [c] = locateCitations(['The index is kept in memory.'], [cut])
    expect(c.found).toBe(true)
    expect(c.end).toBe(cut.text.length)
  })

  it('says so when a statement is not in any chunk', () => {
    const [c] = locateCitations(['Nothing like this appears.'], [chunk])
    expect(c).toMatchObject({ found: false, rank: null, start: null })
  })
})

describe('demo query', () => {
  it('ranks the document that answers the question first', async () => {
    const result = await freshApi().query('Why can an inner-product index be used for cosine similarity?', 4)
    expect(result.retrieved[0].source_file).toBe('vector_search_and_faiss.txt')
    expect(result.retrieved.map((c) => c.rank)).toEqual([1, 2, 3, 4])
    const scores = result.retrieved.map((c) => c.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('gives every statement an exact location in its passage', async () => {
    const result = await freshApi().query('What is recall at k?', 4)
    expect(result.answer.citations.length).toBeGreaterThan(0)
    for (const citation of result.answer.citations) {
      expect(citation.found).toBe(true)
      const passage = result.retrieved.find((c) => c.rank === citation.rank)!
      const located = passage.text!.slice(citation.start!, citation.end!)
      expect(citation.statement.startsWith(located)).toBe(true)
    }
  })

  it('separates the evaluation questions the documents answer from those they do not', async () => {
    const api = freshApi()
    for (const question of questions) {
      const result = await api.query(question.q, 4)
      expect(result.answerable, `${question.id}: ${question.q}`).toBe(question.a)
      expect(result.confidence_threshold).toBe(DEMO_THRESHOLD)
    }
  })

  it('respects the number of passages asked for', async () => {
    const result = await freshApi().query('What is recall at k?', 2)
    expect(result.retrieved).toHaveLength(2)
  })
})

describe('demo documents', () => {
  const upload = (api: ReturnType<typeof freshApi>, name: string, text: string) =>
    api.uploadDocument(new File([text], name, { type: 'text/plain' }))

  it('lists the sample documents with passage counts that add up', async () => {
    const list = await freshApi().listDocuments()
    expect(list.documents).toHaveLength(11)
    expect(list.documents.every((d) => d.origin === 'sample')).toBe(true)
    expect(list.total_chunks).toBe(list.documents.reduce((sum, d) => sum + d.chunks, 0))
  })

  it('makes an uploaded document searchable, and unsearchable again once removed', async () => {
    const api = freshApi()
    const note = 'Quarterly reports should be archived for seven years. The archive must live in a separate region.'
    const { document } = await upload(api, 'retention.txt', note)
    expect(document).toMatchObject({ name: 'retention.txt', origin: 'uploaded', chunks: 1 })

    const found = await api.query('How long should quarterly reports be archived?', 3)
    expect(found.retrieved[0].source_file).toBe('retention.txt')

    await api.deleteDocument('retention.txt')
    const after = await api.query('How long should quarterly reports be archived?', 3)
    expect(after.retrieved.every((c) => c.source_file !== 'retention.txt')).toBe(true)
  })

  it.each([
    ['notes.docx', 'x', 415],
    ['scan.pdf', 'x', 415],
    ['empty.txt', '   ', 422],
  ])('rejects %s', async (name, text, status) => {
    await expect(upload(freshApi(), name, text)).rejects.toMatchObject({ status })
  })

  it('rejects a duplicate name, ignoring letter case', async () => {
    const api = freshApi()
    await expect(upload(api, 'AI_in_Finance.txt', 'Some words about finance and risk here.')).rejects.toMatchObject({
      status: 409,
    })
  })

  it('will not delete a sample document or one that does not exist', async () => {
    const api = freshApi()
    await expect(api.deleteDocument('ai_in_finance.txt')).rejects.toBeInstanceOf(ApiError)
    await expect(api.deleteDocument('ai_in_finance.txt')).rejects.toMatchObject({ status: 403 })
    await expect(api.deleteDocument('nope.txt')).rejects.toMatchObject({ status: 404 })
  })
})
