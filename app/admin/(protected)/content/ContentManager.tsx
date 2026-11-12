'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowUpRight, RotateCcw, Save } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { DEFAULT_PERSONAL_CONTENT, type PersonalContent } from '@/lib/personal-content'
import { AboutRichTextEditor } from './AboutRichTextEditor'

const inputClass = 'w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] placeholder:text-[var(--stone-gray)] focus-visible:outline-2 focus-visible:outline-[var(--editor-accent)] disabled:opacity-60'
const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] focus-visible:outline-2 focus-visible:outline-[var(--editor-accent)] disabled:cursor-not-allowed disabled:opacity-40'

interface ContentFieldProps {
  label: string
  value: string
  maxLength: number
  onChange: (value: string) => void
  hint?: string
  rows?: number
}

function ContentField({ label, value, maxLength, onChange, hint, rows }: ContentFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-sm text-[var(--editor-muted)]">
        <span>{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-[var(--stone-gray)]">{value.length}/{maxLength}</span>
      </span>
      {rows ? (
        <textarea
          required
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} resize-y leading-6`}
        />
      ) : (
        <input
          required
          type="text"
          maxLength={maxLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-[var(--editor-muted)]">{hint}</span>}
    </label>
  )
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]">
      <div className="border-b border-[var(--editor-line)] px-5 py-4 sm:px-6">
        <h2 className="font-serif text-lg font-medium text-[var(--editor-ink)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--editor-muted)]">{description}</p>
      </div>
      <div className="grid gap-5 p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function ContentManager({ initialContent }: { initialContent: PersonalContent }) {
  const [draft, setDraft] = useState(initialContent)
  const [savedContent, setSavedContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedContent), [draft, savedContent])

  function updateSection<S extends keyof PersonalContent>(
    section: S,
    key: keyof PersonalContent[S],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving || !dirty) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const payload = await response.json() as { content?: PersonalContent; error?: string }
      if (response.status === 401) throw new Error('登录已过期，请重新登录后台后再试。')
      if (!response.ok || !payload.content) throw new Error(payload.error || '保存失败，请重试。')
      setDraft(payload.content)
      setSavedContent(payload.content)
      toast.success('站点文案已保存')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存失败，请重试。'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[var(--editor-ink)]" style={{ fontFamily: 'Georgia, serif' }}>站点文案</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--editor-muted)]">管理首页固定文案，并像写文章一样编辑完整的个人简介。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" target="_blank" className={secondaryButtonClass}>查看首页 <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          <Link href="/about" target="_blank" className={secondaryButtonClass}>查看关于页 <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="首页首屏" description="对应首页顶部的身份标签、主标题和个人简介。">
          <ContentField label="身份标签" value={draft.hero.role} maxLength={80} onChange={(value) => updateSection('hero', 'role', value)} />
          <ContentField label="主标题" value={draft.hero.headline} maxLength={160} rows={2} onChange={(value) => updateSection('hero', 'headline', value)} hint="中文逗号或换行会作为标题的自然分行位置。" />
          <ContentField label="个人简介" value={draft.hero.introduction} maxLength={500} rows={4} onChange={(value) => updateSection('hero', 'introduction', value)} />
        </SectionCard>

        <SectionCard title="首页联系区" description="对应首页底部的招聘眉题、标题和补充说明。">
          <ContentField label="眉题" value={draft.contact.eyebrow} maxLength={100} onChange={(value) => updateSection('contact', 'eyebrow', value)} />
          <ContentField label="标题" value={draft.contact.headline} maxLength={200} rows={3} onChange={(value) => updateSection('contact', 'headline', value)} />
          <ContentField label="补充说明" value={draft.contact.description} maxLength={500} rows={4} onChange={(value) => updateSection('contact', 'description', value)} />
        </SectionCard>
      </div>

      <SectionCard title="关于页简介" description="这是一篇完整的富文本正文。选中文字即可使用加粗等格式，也可以插入标题、列表、引用和链接。">
        <AboutRichTextEditor value={draft.about.html} onChange={(value) => updateSection('about', 'html', value)} />
      </SectionCard>

      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]/95 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--editor-muted)]" aria-live="polite">{dirty ? '有尚未保存的修改' : '所有修改均已保存'}</p>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={() => { setDraft(structuredClone(DEFAULT_PERSONAL_CONTENT)); setError('') }} className={secondaryButtonClass}>
            <RotateCcw className="size-4" aria-hidden="true" />恢复默认文案
          </button>
          <button type="submit" disabled={saving || !dirty} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--editor-ink)] px-4 py-2 text-sm font-medium text-[var(--editor-panel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--editor-accent)] disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="size-4" aria-hidden="true" />{saving ? '保存中…' : '保存全部文案'}
          </button>
        </div>
      </div>
    </form>
  )
}
