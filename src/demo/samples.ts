const files = import.meta.glob('./docs/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

/** Bundled sample documents, keyed by file name. */
export const sampleTexts: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.split('/').pop()!, text]),
)
