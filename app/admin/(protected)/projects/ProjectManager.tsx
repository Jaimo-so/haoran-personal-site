'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, ChevronUp, Eye, EyeOff, FolderOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { getProjectLinks } from '@/lib/project-links'
import type { ManagedProject, ManagedProjectInput } from '@/lib/managed-projects'

const EMPTY_DRAFT: ManagedProjectInput = { name: '', description: '', link_url: '', github_url: '', is_visible: 1 }
const inputClass = 'w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] placeholder:text-[var(--stone-gray)] focus-visible:outline-2 focus-visible:outline-[var(--editor-accent)]'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] focus-visible:outline-2 focus-visible:outline-[var(--editor-accent)] disabled:cursor-not-allowed disabled:opacity-40'

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401) throw new Error('登录已过期，请重新登录后台后再试。')
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || '操作失败，请重试。')
  return payload as T
}

export function ProjectManager({ initialProjects }: { initialProjects: ManagedProject[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [draft, setDraft] = useState<ManagedProjectInput>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ManagedProject | null>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const visibleCount = projects.filter((project) => project.is_visible === 1).length
  const query = search.trim().toLocaleLowerCase('zh-CN')
  const filteredProjects = projects.filter((project) =>
    `${project.name} ${project.description} ${project.link_url} ${project.github_url || ""}`.toLocaleLowerCase('zh-CN').includes(query),
  )

  function openEditor(project?: ManagedProject) {
    if (busyRef.current) return
    setError('')
    setEditingId(project?.id ?? null)
    setDraft(project ? { name: project.name, description: project.description, link_url: getProjectLinks(project).website, github_url: getProjectLinks(project).github, is_visible: project.is_visible } : EMPTY_DRAFT)
    setEditorOpen(true)
    requestAnimationFrame(() => {
      nameInput.current?.focus({ preventScroll: true })
      nameInput.current?.scrollIntoView({ block: 'center' })
    })
  }

  function closeEditor() {
    if (busyRef.current) return
    setEditorOpen(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setError('')
  }

  async function mutate(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请重试。')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function saveProject(event: React.FormEvent) {
    event.preventDefault()
    await mutate(async () => {
      const { project } = await request<{ project: ManagedProject }>(
        editingId ? `/api/admin/projects/${editingId}` : '/api/admin/projects',
        editingId ? 'PATCH' : 'POST', draft,
      )
      setProjects((current) => editingId ? current.map((item) => item.id === editingId ? project : item) : [...current, project])
      toast.success(editingId ? '项目已更新' : '项目已添加')
      setEditorOpen(false)
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    })
  }

  async function toggleVisibility(project: ManagedProject) {
    await mutate(async () => {
      const { project: updated } = await request<{ project: ManagedProject }>(`/api/admin/projects/${project.id}`, 'PATCH', { is_visible: project.is_visible === 1 ? 0 : 1 })
      setProjects((current) => current.map((item) => item.id === project.id ? updated : item))
      if (editingId === project.id) setDraft((current) => ({ ...current, is_visible: updated.is_visible }))
      toast.success(updated.is_visible === 1 ? '项目已显示在首页' : '项目已从首页隐藏')
    })
  }

  async function moveProject(id: number, direction: -1 | 1) {
    const index = projects.findIndex((project) => project.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= projects.length) return
    await mutate(async () => {
      const reordered = [...projects]
      ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
      const payload = await request<{ projects: ManagedProject[] }>('/api/admin/projects', 'PUT', { ids: reordered.map((project) => project.id) })
      setProjects(payload.projects)
      toast.success('项目顺序已更新')
    })
  }

  function closeDelete() {
    if (busyRef.current) return
    deleteDialog.current?.close()
    setDeleteTarget(null)
    setError('')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await mutate(async () => {
      await request(`/api/admin/projects/${deleteTarget.id}`, 'DELETE')
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) {
        setEditorOpen(false)
        setEditingId(null)
        setDraft(EMPTY_DRAFT)
      }
      deleteDialog.current?.close()
      setDeleteTarget(null)
      toast.success('项目已删除')
    })
  }

  return (
    <div className="space-y-6" aria-busy={busy}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance font-serif text-2xl font-medium text-[var(--editor-ink)]">项目管理</h1>
          <p className="mt-2 text-pretty text-sm leading-6 text-[var(--editor-muted)]">管理首页“我的项目”的内容、展示状态和顺序。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/#work" target="_blank" rel="noopener noreferrer" className={buttonClass}>查看首页 <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          <button type="button" disabled={busy} onClick={() => openEditor()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--editor-accent)] px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--editor-accent)] disabled:opacity-40">
            <Plus className="size-4" aria-hidden="true" />新增项目
          </button>
        </div>
      </div>

      {error && !deleteTarget && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      {editorOpen && (
        <section aria-labelledby="project-editor-title" className="overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]">
          <div className="flex items-center justify-between border-b border-[var(--editor-line)] px-5 py-4 sm:px-6">
            <h2 id="project-editor-title" className="text-base font-semibold text-[var(--editor-ink)]">{editingId ? '编辑项目' : '添加新项目'}</h2>
            <button type="button" onClick={closeEditor} disabled={busy} className={buttonClass} aria-label="关闭项目编辑器"><X className="size-4" /></button>
          </div>
          <form onSubmit={saveProject} className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
            <fieldset disabled={busy} className="min-w-0 space-y-5 p-5 sm:p-6">
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--editor-muted)]">项目名称 <span aria-hidden="true">*</span></span>
                <input ref={nameInput} required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：AI 产品拆解" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-sm text-[var(--editor-muted)]">项目介绍 <span className="text-xs tabular-nums">{draft.description.length}/500</span></span>
                <textarea maxLength={500} rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="介绍项目解决的问题、你的工作与成果。" className={`${inputClass} resize-y leading-6`} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--editor-muted)]">网站地址（选填）</span>
                <input type="url" maxLength={1000} value={draft.link_url} onChange={(event) => setDraft({ ...draft, link_url: event.target.value })} placeholder="https://…" aria-describedby="project-link-hint" className={inputClass} />
                <span id="project-link-hint" className="mt-1.5 block text-xs leading-5 text-[var(--editor-muted)]">点击首页项目卡片时打开此地址；未填写时跳转至 GitHub。</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--editor-muted)]">GitHub 仓库地址（选填）</span>
                <input type="url" maxLength={1000} value={draft.github_url} onChange={(event) => setDraft({ ...draft, github_url: event.target.value })} placeholder="https://github.com/用户名/仓库名" className={inputClass} />
                <span className="mt-1.5 block text-xs leading-5 text-[var(--editor-muted)]">对应首页“GitHub”按钮，也用于网站地址未填写时的卡片跳转。未填写时按钮不可点击。</span>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--editor-line)] pt-5">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--editor-ink)]">
                  <input type="checkbox" checked={draft.is_visible === 1} onChange={(event) => setDraft({ ...draft, is_visible: event.target.checked ? 1 : 0 })} className="size-4 accent-[var(--editor-accent)]" />在首页展示
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={closeEditor} className={buttonClass}>取消</button>
                  <button type="submit" disabled={busy || !draft.name.trim()} className="rounded-lg bg-[var(--editor-ink)] px-4 py-2 text-sm font-medium text-[var(--editor-panel)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--editor-accent)] disabled:opacity-40">{busy ? '保存中…' : editingId ? '保存修改' : '添加项目'}</button>
                </div>
              </div>
            </fieldset>
            <aside className="border-t border-[var(--editor-line)] bg-[var(--editor-soft)] p-5 sm:p-6 lg:border-l lg:border-t-0">
              <p className="mb-3 text-xs font-medium text-[var(--editor-muted)]">首页卡片预览</p>
              <div className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-6">
                <span className="text-sm tabular-nums text-[var(--editor-accent)]">{String(editingId ? projects.findIndex((project) => project.id === editingId) + 1 : projects.length + 1).padStart(2, '0')}</span>
                <h3 className="mt-12 break-words font-serif text-xl font-medium text-[var(--editor-ink)]">{draft.name || '项目名称'}</h3>
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-[var(--editor-muted)]">{draft.description || '在这里预览项目介绍。'}</p>
                {draft.github_url.trim() && <span className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--editor-accent)]">GitHub <ArrowUpRight className="size-4" aria-hidden="true" /></span>}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--editor-muted)]">{getProjectLinks(draft).website ? '点击卡片打开网站。' : getProjectLinks(draft).github ? '点击卡片打开 GitHub。' : '填写网站或 GitHub 地址后，卡片支持点击跳转。'}</p>
              {draft.is_visible === 0 && <p className="mt-3 text-xs leading-5 text-[var(--editor-muted)]">此项目已设为隐藏，保存后仅在后台保留。</p>}
            </aside>
          </form>
        </section>
      )}

      <section aria-label="项目列表" className="overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]">
        <div className="flex flex-col gap-4 border-b border-[var(--editor-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-[var(--editor-ink)]">全部项目 <span className="ml-2 tabular-nums text-[var(--editor-muted)]">{projects.length} 个 · {visibleCount} 个展示中</span></p>
          <label className="relative block sm:w-64">
            <Search className="absolute left-3 top-3 size-4 text-[var(--editor-muted)]" aria-hidden="true" />
            <input type="search" aria-label="搜索项目" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索项目" className={`${inputClass} pl-9`} />
          </label>
        </div>
        {filteredProjects.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FolderOpen className="mx-auto size-7 text-[var(--editor-muted)]" aria-hidden="true" />
            <p className="mt-4 text-sm text-[var(--editor-ink)]">{projects.length === 0 ? '还没有项目，添加你的第一个作品。' : '没有匹配的项目。'}</p>
            <button type="button" disabled={busy} onClick={() => projects.length === 0 ? openEditor() : setSearch('')} className={`${buttonClass} mt-3`}>{projects.length === 0 ? '新增项目' : '清除搜索'}</button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--editor-line)]">
            {filteredProjects.map((project) => {
              const index = projects.findIndex((item) => item.id === project.id)
              return (
                <article key={project.id} className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="text-sm tabular-nums text-[var(--editor-accent)]">{String(index + 1).padStart(2, '0')}</span>
                      <h2 className="min-w-0 break-words font-serif text-lg text-[var(--editor-ink)]">{project.name}</h2>
                      <span className="shrink-0 rounded-full bg-[var(--editor-soft)] px-2 py-1 text-xs text-[var(--editor-muted)]">{project.is_visible === 1 ? '展示中' : '已隐藏'}</span>
                    </div>
                    {project.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[var(--editor-muted)]">{project.description}</p>}
                    {project.link_url && <a href={project.link_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 text-xs text-[var(--editor-accent)] hover:underline"><span className="truncate">{project.link_url}</span><ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /></a>}
                    {project.github_url && <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 text-xs text-[var(--editor-accent)] hover:underline"><span className="truncate">{project.github_url}</span><ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /></a>}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <button type="button" disabled={busy || index === 0 || !!query} onClick={() => moveProject(project.id, -1)} title={query ? '清除搜索后调整顺序' : '上移'} aria-label={`上移${project.name}`} className={buttonClass}><ChevronUp className="size-4" /></button>
                    <button type="button" disabled={busy || index === projects.length - 1 || !!query} onClick={() => moveProject(project.id, 1)} title={query ? '清除搜索后调整顺序' : '下移'} aria-label={`下移${project.name}`} className={buttonClass}><ChevronDown className="size-4" /></button>
                    <button type="button" disabled={busy} onClick={() => toggleVisibility(project)} title={project.is_visible === 1 ? '隐藏' : '显示'} aria-label={`${project.is_visible === 1 ? '隐藏' : '显示'}${project.name}`} className={buttonClass}>{project.is_visible === 1 ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button>
                    <button type="button" disabled={busy} onClick={() => openEditor(project)} title="编辑" aria-label={`编辑${project.name}`} className={buttonClass}><Pencil className="size-4" /></button>
                    <button type="button" disabled={busy} onClick={() => { setError(''); setDeleteTarget(project); deleteDialog.current?.showModal() }} title="删除" aria-label={`删除${project.name}`} className={`${buttonClass} hover:text-rose-600`}><Trash2 className="size-4" /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <dialog ref={deleteDialog} aria-labelledby="delete-project-title" aria-describedby="delete-project-description" onCancel={(event) => { event.preventDefault(); closeDelete() }} className="fixed inset-0 m-auto w-full max-w-md rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-6 text-[var(--editor-ink)] backdrop:bg-black/50">
        <h2 id="delete-project-title" className="text-lg font-semibold">删除项目</h2>
        <p id="delete-project-description" className="mt-3 break-words text-sm leading-6 text-[var(--editor-muted)]">确定删除“{deleteTarget?.name}”吗？删除后无法恢复。项目链接指向的作品不会受到影响。</p>
        {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={closeDelete} className={buttonClass}>取消</button>
          <button type="button" disabled={busy} onClick={confirmDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{busy ? '删除中…' : '确认删除'}</button>
        </div>
      </dialog>
    </div>
  )
}
