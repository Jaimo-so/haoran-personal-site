'use client'

import { useState } from 'react'

interface Props {
  initialValue: string
  onSave: (value: string) => void
  saving: boolean
}

export function CustomJsEditor({ initialValue, onSave, saving }: Props) {
  const [code, setCode] = useState(initialValue)

  return (
    <div className="space-y-3">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] p-3 font-mono text-sm text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] outline-none focus:border-[var(--editor-accent)] transition-colors resize-y"
        placeholder={'<script>\n  // 在此粘贴统计代码\n</script>'}
      />
      <button
        onClick={() => onSave(code)}
        disabled={saving}
        className="h-9 px-4 rounded-lg text-sm font-medium bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] hover:brightness-105 disabled:opacity-60 transition-colors"
      >
        {saving ? '保存中…' : '保存代码'}
      </button>
    </div>
  )
}
