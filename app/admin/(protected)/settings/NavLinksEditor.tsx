'use client'

import { useState } from 'react'

interface NavLink {
  label: string
  url: string
  openInNewTab: boolean
}

interface Props {
  initialValue: string
  onSave: (value: string) => void
  saving: boolean
}

const defaultLinks: NavLink[] = [
  { label: '关于', url: '/about', openInNewTab: false },
  { label: '文章', url: '/#writing', openInNewTab: false },
  { label: '项目', url: '/#work', openInNewTab: false },
  { label: 'RSS', url: '/feed.xml', openInNewTab: false },
]

export function NavLinksEditor({ initialValue, onSave, saving }: Props) {
  const parsed = initialValue ? (() => { try { return JSON.parse(initialValue) } catch { return null } })() : null
  const initialLinks = parsed && Array.isArray(parsed)
    ? parsed.map((link: NavLink) => (link.label === '关于' ? { ...link, url: '/about', openInNewTab: false } : link))
    : defaultLinks
  const [links, setLinks] = useState<NavLink[]>(initialLinks)

  const update = (idx: number, field: keyof NavLink, value: string | boolean) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const remove = (idx: number) => setLinks((prev) => prev.filter((_, i) => i !== idx))

  const add = () => setLinks((prev) => [...prev, { label: '', url: '', openInNewTab: false }])

  const moveUp = (idx: number) => {
    if (idx <= 0) return
    setLinks((prev) => { const n = [...prev]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n })
  }

  const moveDown = (idx: number) => {
    if (idx >= links.length - 1) return
    setLinks((prev) => { const n = [...prev]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]]; return n })
  }

  const inputCls = 'h-9 rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 text-sm text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] outline-none focus:border-[var(--editor-accent)] transition-colors'
  const btnCls = 'h-9 px-3 rounded-lg text-sm font-medium transition-colors'

  return (
    <div className="space-y-3">
      {links.map((link, idx) => (
        <div key={idx} className="flex items-center gap-2 flex-wrap">
          <input
            className={`${inputCls} w-24`}
            placeholder="名称"
            value={link.label}
            onChange={(e) => update(idx, 'label', e.target.value)}
          />
          <input
            className={`${inputCls} flex-1 min-w-[180px]`}
            placeholder="URL"
            value={link.url}
            onChange={(e) => update(idx, 'url', e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-xs text-[var(--editor-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={link.openInNewTab}
              onChange={(e) => update(idx, 'openInNewTab', e.target.checked)}
              className="accent-[var(--editor-accent)]"
            />
            新窗口
          </label>
          <button onClick={() => moveUp(idx)} disabled={idx === 0} className={`${btnCls} bg-[var(--editor-soft)] text-[var(--editor-muted)] hover:text-[var(--editor-ink)] disabled:opacity-30`}>↑</button>
          <button onClick={() => moveDown(idx)} disabled={idx === links.length - 1} className={`${btnCls} bg-[var(--editor-soft)] text-[var(--editor-muted)] hover:text-[var(--editor-ink)] disabled:opacity-30`}>↓</button>
          <button onClick={() => remove(idx)} className={`${btnCls} text-red-500 hover:bg-rose-500/10`}>删除</button>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button onClick={add} className={`${btnCls} bg-[var(--editor-soft)] text-[var(--editor-ink)] hover:bg-[var(--border-warm)]`}>
          + 添加链接
        </button>
        <button
          onClick={() => onSave(JSON.stringify(links))}
          disabled={saving}
          className={`${btnCls} bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] hover:brightness-105 disabled:opacity-60`}
        >
          {saving ? '保存中…' : '保存导航'}
        </button>
      </div>
    </div>
  )
}
