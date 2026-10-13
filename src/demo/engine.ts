import { ApiError } from '../api/types'
import type {
  Api,
  Citation,
  DocumentInfo,
  DocumentList,
  IndexInfo,
  QueryResponse,
  RetrievedChunk,
} from '../api/types'

/**
 * A small in-browser stand-in for the backend, so the app can run with no server.
 * It uses word-overlap (TF-IDF) retrieval over bundled sample text instead of the
 * backend's embedding model, so its scores are on a different scale. It follows the
 * same chunking and sentence-picking rules as the real service.
 */

const CHUNK_SIZE = 180
const OVERLAP = 35
const MAX_BYTES = 1024 * 1024
// TF-IDF similarities run lower than embedding similarities, so the demo uses its own
// threshold. On the 37 evaluation questions it separates the two groups (answerable
// 0.36 and above, unanswerable 0.27 and below), but it was chosen on those same
// questions, so treat it as a demo setting rather than a measured accuracy.
export const DEMO_THRESHOLD = 0.3

const STOPWORDS = new Set(
  'across about after also because been being from have into more over that their there these this through using what when where which while with would the and for are was were can how why does not but its any all out our you your'.split(
    ' ',
  ),
)

interface StoredDocument {
  name: string
  origin: 'sample' | 'uploaded'
  text: string
  sizeBytes: number
}

interface Chunk {
  chunkId: number
  source: string
  text: string
  tf: Map<string, number>
}

export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z][a-z-]{2,}\b/g) ?? []
  return words.filter((w) => !STOPWORDS.has(w))
}

function normalize(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ')
}

export function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  const step = CHUNK_SIZE - OVERLAP
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + CHUNK_SIZE).join(' '))
    if (start + CHUNK_SIZE >= words.length) break
  }
  return chunks
}

export function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6)
}

/** Where each answer statement sits in the retrieved chunks (same rules as the API). */
export function locateCitations(statements: string[], retrieved: { rank: number; source_file: string; chunk_id: number; text: string }[]): Citation[] {
  return statements.map((statement) => {
    const needles = statement.endsWith('.') ? [statement, statement.slice(0, -1)] : [statement]
    for (const chunk of retrieved) {
      for (const needle of needles) {
        const start = chunk.text.indexOf(needle)
        if (start !== -1) {
          return {
            statement,
            found: true,
            rank: chunk.rank,
            chunk_id: chunk.chunk_id,
            source_file: chunk.source_file,
            start,
            end: start + needle.length,
          }
        }
      }
    }
    return { statement, found: false, rank: null, chunk_id: null, source_file: null, start: null, end: null }
  })
}

export function createDemoApi(sampleTexts: Record<string, string>): Api {
  const documents: StoredDocument[] = Object.entries(sampleTexts)
    .map(([name, text]) => ({ name, origin: 'sample' as const, text: normalize(text), sizeBytes: text.length }))
    .sort((a, b) => a.name.localeCompare(b.name))

  let chunks: Chunk[] = []
  let idf = new Map<string, number>()

  function rebuild() {
    chunks = []
    let nextId = 1
    for (const doc of documents) {
      for (const text of chunkText(doc.text)) {
        const tf = new Map<string, number>()
        for (const term of tokenize(text)) tf.set(term, (tf.get(term) ?? 0) + 1)
        chunks.push({ chunkId: nextId++, source: doc.name, text, tf })
      }
    }
    const df = new Map<string, number>()
    for (const chunk of chunks) for (const term of chunk.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1)
    idf = new Map([...df].map(([term, n]) => [term, Math.log((1 + chunks.length) / (1 + n)) + 1]))
  }
  rebuild()

  function vector(tf: Map<string, number>): Map<string, number> {
    const v = new Map<string, number>()
    let norm = 0
    for (const [term, count] of tf) {
      const weight = (1 + Math.log(count)) * (idf.get(term) ?? 1)
      v.set(term, weight)
      norm += weight * weight
    }
    norm = Math.sqrt(norm) || 1
    for (const [term, weight] of v) v.set(term, weight / norm)
    return v
  }

  function describe(): DocumentInfo[] {
    return documents.map((d) => ({
      name: d.name,
      origin: d.origin,
      chunks: chunks.filter((c) => c.source === d.name).length,
      size_bytes: d.sizeBytes,
    }))
  }

  const indexInfo = (): IndexInfo => ({
    embedding_model: 'word-overlap (demo)',
    dimension: idf.size,
    index_type: 'in-memory',
    documents: documents.length,
    chunks: chunks.length,
  })

  return {
    mode: 'demo',
    label: 'Sample documents in your browser',

    async getIndex() {
      return indexInfo()
    },

    async listDocuments(): Promise<DocumentList> {
      return { documents: describe(), total_chunks: chunks.length }
    },

    async query(question, topK): Promise<QueryResponse> {
      const started = performance.now()
      const queryTerms = new Set(tokenize(question))
      const q = vector(new Map([...queryTerms].map((t) => [t, 1])))

      const scored = chunks
        .map((chunk) => {
          const v = vector(chunk.tf)
          let dot = 0
          for (const [term, weight] of q) dot += weight * (v.get(term) ?? 0)
          return { chunk, score: dot }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      const retrieved: RetrievedChunk[] = scored.map(({ chunk, score }, i) => ({
        rank: i + 1,
        source_file: chunk.source,
        chunk_id: chunk.chunkId,
        score: Math.round(score * 10000) / 10000,
        text: chunk.text,
      }))

      // Rank sentences from the retrieved chunks: chunk score plus a bonus per shared term.
      const candidates: { sentence: string; score: number }[] = []
      for (const { chunk, score } of scored) {
        for (const sentence of splitSentences(chunk.text)) {
          const overlap = tokenize(sentence).filter((t) => queryTerms.has(t))
          candidates.push({ sentence, score: score + 0.08 * new Set(overlap).size })
        }
      }
      candidates.sort((a, b) => b.score - a.score)
      const seen = new Set<string>()
      const statements: string[] = []
      for (const { sentence } of candidates) {
        const key = sentence.toLowerCase().split(/\s+/).slice(0, 12).join(' ')
        if (seen.has(key)) continue
        seen.add(key)
        statements.push(/[.!?]$/.test(sentence) ? sentence : `${sentence}.`)
        if (statements.length === 4) break
      }

      const joined = scored.map((s) => s.chunk.text.toLowerCase()).join(' ')
      const coverage = queryTerms.size
        ? [...queryTerms].filter((t) => joined.includes(t)).length / queryTerms.size
        : 0
      const top = scored.slice(0, 3).map((s) => Math.max(0, s.score))
      const avg = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 0
      const confidence = Math.min(1, 0.55 * avg + 0.35 * coverage + (top.length ? 0.1 : 0))

      return {
        question,
        answer: {
          summary: statements.slice(0, 2).join(' '),
          key_insights: statements,
          citations: locateCitations(statements, retrieved as never),
          confidence_score: Math.round(confidence * 10000) / 10000,
        },
        answerable: confidence >= DEMO_THRESHOLD && statements.length > 0,
        confidence_threshold: DEMO_THRESHOLD,
        retrieved,
        latency_ms: Math.round((performance.now() - started) * 100) / 100,
      }
    },

    async uploadDocument(file) {
      if (!/^[\w][\w .()-]{0,100}\.(txt|pdf)$/i.test(file.name)) {
        throw new ApiError(415, 'Only .txt and .pdf files with a plain file name are accepted.')
      }
      if (!file.name.toLowerCase().endsWith('.txt')) {
        throw new ApiError(415, 'Demo mode reads .txt files only. Connect the API to upload PDFs.')
      }
      if (file.size > MAX_BYTES) throw new ApiError(413, 'In demo mode, files can be up to 1 MB.')
      const text = normalize(await file.text())
      if (!text) throw new ApiError(422, 'The file is empty.')
      if (documents.some((d) => d.name.toLowerCase() === file.name.toLowerCase())) {
        throw new ApiError(409, `A document named ${file.name} already exists.`)
      }
      documents.push({ name: file.name, origin: 'uploaded', text, sizeBytes: file.size })
      rebuild()
      const document = describe().find((d) => d.name === file.name)!
      return { document, index: indexInfo() }
    },

    async deleteDocument(name) {
      const i = documents.findIndex((d) => d.name === name)
      if (i === -1) throw new ApiError(404, `No uploaded document named ${name}.`)
      if (documents[i].origin === 'sample') throw new ApiError(403, 'Sample documents cannot be deleted.')
      documents.splice(i, 1)
      rebuild()
    },
  }
}
