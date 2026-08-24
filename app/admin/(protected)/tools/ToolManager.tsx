'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Blocks,
  BookOpenCheck,
  Bot,
  ChevronDown,
  ChevronUp,
  CodeXml,
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/Toast'
import type { ManagedTool, ManagedToolIcon } from '@/lib/managed-tools'

type ToolDraft = Pick<
  ManagedTool,
  'name' | 'category' | 'description' | 'link_url' | 'icon' | 'is_visible'
>

const ICON_OPTIONS: Array<{ value: ManagedToolIcon; label: string; icon: LucideIcon }> = [
  { value: 'globe', label: '网页', icon: Globe },
  { value: 'book', label: '知识库', icon: BookOpenCheck },
  { value: 'bot', label: 'AI', icon: Bot },
  { value: 'blocks', label: '扩展', icon: Blocks },
  { value: 'code', label: '开发', icon: CodeXml },
]

const ICON_MAP = Object.fromEntries(
  ICON_OPTIONS.map((item) => [item.value, item.icon]),
) as Record<ManagedToolIcon, LucideIcon>

const EMPTY_DRAFT: ToolDraft = {
  name: '',
  category: '',
  description: '',
  link_url: '',
  icon: 'globe',
  is_visible: 1,
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || '操作失败')
  return payload
}

export function ToolManager({ initialTools }: { initialTools: ManagedTool[] }) {
  const [tools, setTools] = useState(initialTools)
  const [draft, setDraft] = useState<ToolDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ManagedTool | null>(null)
  const toast = useToast()

  const visibleCount = tools.filter((tool) => tool.is_visible === 1).length
  const filteredTools = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('zh-CN')
    if (!query) return tools
    return tools.filter((tool) => (
      `${tool.name} ${tool.category} ${tool.description} ${tool.link_url}`
        .toLocaleLowerCase('zh-CN')
        .includes(query)
    ))
  }, [search, tools])

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setEditingId(null)
    setEditorOpen(true)
  }

  const openEdit = (tool: ManagedTool) => {
    setDraft({
      name: tool.name,
      category: tool.category,
      description: tool.description,
      link_url: tool.link_url,
      icon: tool.icon,
      is_visible: tool.is_visible,
    })
    setEditingId(tool.id)
    setEditorOpen(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const closeEditor = () => {
    if (submitting) return
    setEditorOpen(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  const saveTool = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim() || !draft.category.trim() || !draft.link_url.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(
        editingId ? `/api/admin/tools/${editingId}` : '/api/admin/tools',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      )
      const { tool } = await readResponse<{ tool: ManagedTool }>(response)

      setTools((current) => editingId
        ? current.map((item) => item.id === editingId ? tool : item)
        : [...current, tool])
      toast.success(editingId ? '工具已更新' : '新工具已添加')
      setEditorOpen(false)
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleVisibility = async (tool: ManagedTool) => {
    const nextValue = tool.is_visible === 1 ? 0 : 1
    setBusyId(tool.id)
    try {
      const response = await fetch(`/api/admin/tools/${tool.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: nextValue }),
      })
      const { tool: updated } = await readResponse<{ tool: ManagedTool }>(response)
      setTools((current) => current.map((item) => item.id === tool.id ? updated : item))
      toast.success(nextValue === 1 ? '工具已显示' : '工具已隐藏')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新展示状态失败')
    } finally {
      setBusyId(null)
    }
  }

  const moveTool = async (id: number, direction: -1 | 1) => {
    const currentIndex = tools.findIndex((tool) => tool.id === id)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= tools.length) return

    const previous = tools
    const next = [...tools]
    ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
    setTools(next)
    setReordering(true)

    try {
      const response = await fetch('/api/admin/tools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((tool) => tool.id) }),
      })
      const payload = await readResponse<{ tools: ManagedTool[] }>(response)
      setTools(payload.tools)
    } catch (error) {
      setTools(previous)
      toast.error(error instanceof Error ? error.message : '调整顺序失败')
    } finally {
      setReordering(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return false
    setBusyId(deleteTarget.id)
    try {
      const response = await fetch(`/api/admin/tools/${deleteTarget.id}`, { method: 'DELETE' })
      await readResponse<{ success: boolean }>(response)
      setTools((current) => current.filter((tool) => tool.id !== deleteTarget.id))
      toast.success('工具已删除')
      setDeleteTarget(null)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
      return false
    } finally {
      setBusyId(null)
    }
  }

  const PreviewIcon = ICON_MAP[draft.icon]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--editor-accent)]">
            Toolkit
          </p>
          <h1 className="font-serif text-2xl font-medium text-[var(--editor-ink)]">工具管理</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--editor-muted)]">
            自由维护工具名称、分类、介绍和链接，并控制展示状态与顺序。
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--editor-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          新增工具
        </button>
      </div>

      {editorOpen && (
        <section className="overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]">
          <div className="flex items-center justify-between border-b border-[var(--editor-line)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--editor-ink)]">
                {editingId ? '编辑工具' : '添加新工具'}
              </h2>
              <p className="mt-1 text-xs text-[var(--editor-muted)]">修改内容会在保存后立即生效。</p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded-lg p-2 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
              aria-label="关闭编辑器"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={saveTool} className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--editor-muted)]">工具名称 *</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    maxLength={80}
                    required
                    placeholder="例如：网页剪藏工具"
                    className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none transition placeholder:text-[var(--stone-gray)] focus:border-[var(--editor-accent)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--editor-muted)]">分类 *</span>
                  <input
                    value={draft.category}
                    onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                    maxLength={40}
                    required
                    placeholder="例如：Chrome 扩展"
                    className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none transition placeholder:text-[var(--stone-gray)] focus:border-[var(--editor-accent)]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--editor-muted)]">工具链接 *</span>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stone-gray)]" aria-hidden="true" />
                  <input
                    type="url"
                    value={draft.link_url}
                    onChange={(event) => setDraft((current) => ({ ...current, link_url: event.target.value }))}
                    maxLength={1000}
                    required
                    placeholder="https://github.com/..."
                    className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] py-2.5 pl-10 pr-3 text-sm text-[var(--editor-ink)] outline-none transition placeholder:text-[var(--stone-gray)] focus:border-[var(--editor-accent)]"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--editor-muted)]">
                  <span>工具介绍</span>
                  <span className="font-normal tabular-nums text-[var(--stone-gray)]">{draft.description.length}/500</span>
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  maxLength={500}
                  rows={4}
                  placeholder="说明这个工具能解决什么问题、适合谁使用。"
                  className="w-full resize-y rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm leading-6 text-[var(--editor-ink)] outline-none transition placeholder:text-[var(--stone-gray)] focus:border-[var(--editor-accent)]"
                />
              </label>

              <div>
                <span className="mb-2 block text-xs font-medium text-[var(--editor-muted)]">图标风格</span>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((option) => {
                    const Icon = option.icon
                    const selected = draft.icon === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, icon: option.value }))}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${selected
                          ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/8 text-[var(--editor-accent)]'
                          : 'border-[var(--editor-line)] text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]'
                        }`}
                        aria-pressed={selected}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-[var(--editor-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.is_visible === 1}
                  onClick={() => setDraft((current) => ({ ...current, is_visible: current.is_visible === 1 ? 0 : 1 }))}
                  className="inline-flex w-fit items-center gap-3 text-left"
                >
                  <span className={`relative h-6 w-11 rounded-full transition-colors ${draft.is_visible === 1 ? 'bg-[var(--editor-accent)]' : 'bg-[var(--editor-line)]'}`}>
                    <span className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform ${draft.is_visible === 1 ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-[var(--editor-ink)]">保存后立即展示</span>
                    <span className="block text-xs text-[var(--editor-muted)]">关闭后工具仍保留在后台</span>
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={submitting}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !draft.name.trim() || !draft.category.trim() || !draft.link_url.trim()}
                    className="rounded-lg bg-[var(--editor-ink)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? '保存中…' : editingId ? '保存修改' : '添加工具'}
                  </button>
                </div>
              </div>
            </div>

            <aside className="border-t border-[var(--editor-line)] bg-[var(--editor-soft)] p-5 lg:border-l lg:border-t-0 sm:p-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--stone-gray)]">实时预览</p>
              <div className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--editor-soft)] text-[var(--editor-accent)]">
                  <PreviewIcon className="size-5" aria-hidden="true" />
                </div>
                <p className="mt-7 text-xs font-medium text-[var(--editor-accent)]">
                  {draft.category || '工具分类'}
                </p>
                <h3 className="mt-2 font-serif text-xl font-medium text-[var(--editor-ink)]">
                  {draft.name || '工具名称'}
                </h3>
                <p className="mt-3 min-h-20 text-sm leading-6 text-[var(--editor-muted)]">
                  {draft.description || '在这里预览工具介绍。'}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-[var(--editor-line)] pt-4 text-sm font-medium text-[var(--editor-ink)]">
                  <span className="inline-flex items-center gap-2">
                    <GitBranch className="size-4 text-[var(--stone-gray)]" />
                    打开链接
                  </span>
                  <ArrowUpRight className="size-4 text-[var(--stone-gray)]" />
                </div>
              </div>
            </aside>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]">
        <div className="flex flex-col gap-4 border-b border-[var(--editor-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-[var(--editor-ink)]">全部工具</span>
            <span className="rounded-full bg-[var(--editor-soft)] px-2 py-0.5 text-xs text-[var(--editor-muted)]">
              {tools.length}
            </span>
            <span className="text-xs text-[var(--stone-gray)]">{visibleCount} 个展示中</span>
          </div>
          <label className="relative block w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stone-gray)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索工具"
              className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm text-[var(--editor-ink)] outline-none transition placeholder:text-[var(--stone-gray)] focus:border-[var(--editor-accent)]"
            />
          </label>
        </div>

        {filteredTools.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--editor-soft)] text-[var(--stone-gray)]">
              <Blocks className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--editor-ink)]">
              {tools.length === 0 ? '还没有工具' : '没有匹配的工具'}
            </p>
            <p className="mt-1 text-xs text-[var(--editor-muted)]">
              {tools.length === 0 ? '添加第一个工具，开始建立你的工具箱。' : '尝试更换搜索关键词。'}
            </p>
            {tools.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--editor-accent)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus className="size-4" />
                新增工具
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--editor-line)]">
            {filteredTools.map((tool) => {
              const Icon = ICON_MAP[tool.icon] || Globe
              const globalIndex = tools.findIndex((item) => item.id === tool.id)
              const disabled = busyId === tool.id || reordering

              return (
                <article
                  key={tool.id}
                  className={`grid gap-4 px-5 py-5 transition sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${tool.is_visible === 0 ? 'bg-[var(--editor-soft)]/55' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="hidden size-4 text-[var(--editor-line)] sm:block" aria-hidden="true" />
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--editor-soft)] text-[var(--editor-accent)]">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-lg font-medium text-[var(--editor-ink)]">{tool.name}</h2>
                      <span className="rounded-full border border-[var(--editor-line)] px-2 py-0.5 text-[11px] text-[var(--editor-muted)]">
                        {tool.category}
                      </span>
                      {tool.is_visible === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--editor-line)] px-2 py-0.5 text-[11px] text-[var(--editor-muted)]">
                          <EyeOff className="size-3" />
                          已隐藏
                        </span>
                      )}
                    </div>
                    {tool.description && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--editor-muted)]">{tool.description}</p>
                    )}
                    <a
                      href={tool.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs text-[var(--stone-gray)] transition hover:text-[var(--editor-accent)]"
                    >
                      <Link2 className="size-3.5 shrink-0" />
                      <span className="truncate">{tool.link_url}</span>
                      <ArrowUpRight className="size-3.5 shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center justify-end gap-1 sm:pl-3">
                    <button
                      type="button"
                      onClick={() => moveTool(tool.id, -1)}
                      disabled={disabled || globalIndex === 0}
                      className="rounded-lg p-2 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] disabled:cursor-not-allowed disabled:opacity-25"
                      title="上移"
                      aria-label={`上移${tool.name}`}
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTool(tool.id, 1)}
                      disabled={disabled || globalIndex === tools.length - 1}
                      className="rounded-lg p-2 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] disabled:cursor-not-allowed disabled:opacity-25"
                      title="下移"
                      aria-label={`下移${tool.name}`}
                    >
                      <ChevronDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleVisibility(tool)}
                      disabled={disabled}
                      className="rounded-lg p-2 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] disabled:opacity-40"
                      title={tool.is_visible === 1 ? '隐藏' : '显示'}
                      aria-label={`${tool.is_visible === 1 ? '隐藏' : '显示'}${tool.name}`}
                    >
                      {tool.is_visible === 1 ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(tool)}
                      disabled={disabled}
                      className="rounded-lg p-2 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] disabled:opacity-40"
                      title="编辑"
                      aria-label={`编辑${tool.name}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tool)}
                      disabled={disabled}
                      className="rounded-lg p-2 text-[var(--editor-muted)] transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-40"
                      title="删除"
                      aria-label={`删除${tool.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="删除工具"
        description={`确定删除“${deleteTarget?.name ?? ''}”吗？删除后无法恢复，但不会删除 GitHub 上的项目。`}
        confirmText="确认删除"
        type="danger"
        closeOnConfirm={false}
      />
    </div>
  )
}
