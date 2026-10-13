export interface Citation {
  statement: string
  found: boolean
  rank: number | null
  chunk_id: number | null
  source_file: string | null
  start: number | null
  end: number | null
}

export interface Answer {
  summary: string
  key_insights: string[]
  citations: Citation[]
  confidence_score: number
}

export interface RetrievedChunk {
  rank: number
  source_file: string
  chunk_id: number
  score: number
  text: string | null
}

export interface QueryResponse {
  question: string
  answer: Answer
  answerable: boolean
  confidence_threshold: number
  retrieved: RetrievedChunk[]
  latency_ms: number
}

export interface IndexInfo {
  embedding_model: string
  dimension: number
  index_type: string
  documents: number
  chunks: number
}

export interface DocumentInfo {
  name: string
  origin: 'sample' | 'uploaded'
  chunks: number
  size_bytes: number
}

export interface DocumentList {
  documents: DocumentInfo[]
  total_chunks: number
}

export interface UploadResponse {
  document: DocumentInfo
  index: IndexInfo
}

/** Everything the interface needs from a backend. */
export interface Api {
  mode: 'live' | 'demo'
  /** Short description shown in the header, for example the API address. */
  label: string
  query(question: string, topK: number, signal?: AbortSignal): Promise<QueryResponse>
  getIndex(): Promise<IndexInfo>
  listDocuments(): Promise<DocumentList>
  uploadDocument(file: File): Promise<UploadResponse>
  deleteDocument(name: string): Promise<void>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
