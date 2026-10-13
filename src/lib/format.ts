export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Like `percent`, but adds decimals when two different values would otherwise look identical. */
export function percentPair(a: number, b: number): [string, string] {
  for (const digits of [0, 1, 2]) {
    const x = `${(a * 100).toFixed(digits)}%`
    const y = `${(b * 100).toFixed(digits)}%`
    if (x !== y || a === b) return [x, y]
  }
  return [`${(a * 100).toFixed(2)}%`, `${(b * 100).toFixed(2)}%`]
}
