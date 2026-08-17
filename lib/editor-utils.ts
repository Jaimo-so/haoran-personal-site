export function createDefaultTableContent(rows = 3, cols = 3) {
  return {
    type: 'table',
    content: Array.from({ length: rows }, (_, rowIndex) => ({
      type: 'tableRow',
      content: Array.from({ length: cols }, () => ({
        type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  }
}

export function hasMarkdownTable(text: string): boolean {
  const lines = text.split('\n')
  let pipeLines = 0
  let hasSeparator = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      pipeLines += 1
      if (/^\|[\s:]*-{2,}[\s:]*\|/.test(trimmed)) {
        hasSeparator = true
      }
    }
  }

  return pipeLines >= 3 && hasSeparator
}

export function isValidHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export function normalizeUrl(value: string) {
  return isValidHttpUrl(value) ? value : `https://${value}`
}
