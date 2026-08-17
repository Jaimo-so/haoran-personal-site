export function sanitizePostSlugInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/_{2,}/g, '_')
}

export function normalizePostSlug(value: string): string {
  return sanitizePostSlugInput(value)
    .replace(/^[-_]+|[-_]+$/g, '')
}

export function buildAutoDescription(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, maxLength)
}

export function normalizePublishedAt(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return undefined

  const timestamp = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(timestamp) || timestamp <= 0 || timestamp > 8_640_000_000) {
    return null
  }

  return timestamp
}
