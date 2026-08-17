import { describe, expect, it } from 'vitest'
import { extractFilesFromClipboard } from '@/lib/editor-ui'

function createFile(name: string, type: string, content = 'test') {
  return new File([content], name, {
    type,
    lastModified: 1710000000000,
  })
}

describe('editor-ui helpers', () => {
  it('extracts files from clipboard items and removes duplicates', () => {
    const image = createFile('cover.png', 'image/png')
    const duplicate = new File(['test'], 'cover.png', {
      type: 'image/png',
      lastModified: 1710000000000,
    })

    const event = {
      clipboardData: {
        items: [
          { kind: 'string', getAsFile: () => null },
          { kind: 'file', getAsFile: () => image },
          { kind: 'file', getAsFile: () => duplicate },
        ],
        files: [],
      },
    } as never

    const files = extractFilesFromClipboard(event)

    expect(files).toHaveLength(1)
    expect(files[0]?.name).toBe('cover.png')
  })

  it('falls back to clipboardData.files when no file items exist', () => {
    const pdf = createFile('doc.pdf', 'application/pdf')
    const event = {
      clipboardData: {
        items: [{ kind: 'string', getAsFile: () => null }],
        files: [pdf],
      },
    } as never

    const files = extractFilesFromClipboard(event)

    expect(files).toHaveLength(1)
    expect(files[0]?.name).toBe('doc.pdf')
  })
})
