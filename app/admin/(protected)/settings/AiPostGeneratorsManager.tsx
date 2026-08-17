'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dropdown } from '@/components/Dropdown'
import { useToast } from '@/components/Toast'
import {
  AI_IMAGE_ASPECT_RATIO_OPTIONS,
  AI_IMAGE_RESOLUTION_OPTIONS,
  getAiImageAspectRatioLabel,
  getAiImageResolutionLabel,
  type AIImageAspectRatio,
  type AIImageResolution,
} from '@/lib/ai-image-options'

type GeneratorTarget = 'summary' | 'tags' | 'slug' | 'cover'
type ProviderMode = 'workers_ai' | 'profile'

interface GeneratorConfig {
  id: number
  target_key: GeneratorTarget
  label: string
  description: string
  prompt: string
  provider_mode: ProviderMode
  text_profile_id: number | null
  image_profile_id: number | null
  workers_model: string
  temperature: number
  max_tokens: number
  aspect_ratio: AIImageAspectRatio
  resolution: AIImageResolution
  is_enabled: number
}

interface WorkersAiModelsResponse {
  models?: Array<{ id: string; name: string }>
  source?: 'provider' | 'preset'
  warning?: string
  error?: string
}

interface TextProfile {
  id: number
  name: string
  model: string
  is_default: number
}

interface ImageProfile {
  id: number
  name: string
  model: string
  is_default: number
}

const TARGET_ORDER: GeneratorTarget[] = ['summary', 'tags', 'slug', 'cover']

function toNumericInput(value: number) {
  return Number.isFinite(value) ? String(value) : ''
}

function buildModelOptions(models: string[], currentModel: string) {
  const options = models.map((model) => ({ value: model, label: model }))
  const normalizedCurrentModel = currentModel.trim()

  if (!normalizedCurrentModel || options.some((option) => option.value === normalizedCurrentModel)) {
    return options
  }

  return [
    { value: normalizedCurrentModel, label: `${normalizedCurrentModel}（当前值）` },
    ...options,
  ]
}

export function AiPostGeneratorsManager() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [savingTarget, setSavingTarget] = useState<GeneratorTarget | null>(null)
  const [items, setItems] = useState<Record<GeneratorTarget, GeneratorConfig> | null>(null)
  const [textProfiles, setTextProfiles] = useState<TextProfile[]>([])
  const [imageProfiles, setImageProfiles] = useState<ImageProfile[]>([])
  const [workersTextModels, setWorkersTextModels] = useState<string[]>([])
  const [workersImageModels, setWorkersImageModels] = useState<string[]>([])
  const [loadingWorkersModelsTarget, setLoadingWorkersModelsTarget] = useState<GeneratorTarget | null>(null)
  const [workersModelsWarning, setWorkersModelsWarning] = useState<Record<GeneratorTarget, string>>({
    summary: '',
    tags: '',
    slug: '',
    cover: '',
  })

  const textProfileOptions = useMemo(
    () => textProfiles.map((profile) => ({
      value: String(profile.id),
      label: `${profile.is_default ? `${profile.name}（默认）` : profile.name} · ${profile.model}`,
    })),
    [textProfiles],
  )

  const imageProfileOptions = useMemo(
    () => imageProfiles.map((profile) => ({
      value: String(profile.id),
      label: `${profile.is_default ? `${profile.name}（默认）` : profile.name} · ${profile.model}`,
    })),
    [imageProfiles],
  )

  useEffect(() => {
    const load = async () => {
      try {
        const [generatorsRes, textProfilesRes, imageProfilesRes] = await Promise.all([
          fetch('/api/admin/ai-post-generators'),
          fetch('/api/admin/ai-provider'),
          fetch('/api/admin/ai-image-provider'),
        ])

        if (!generatorsRes.ok) throw new Error('加载元数据生成配置失败')

        const generatorsData = await generatorsRes.json() as {
          generators?: GeneratorConfig[]
          workers_ai?: {
            text_models?: string[]
            image_models?: string[]
          }
        }
        const textProfilesData = await textProfilesRes.json().catch(() => ({ profiles: [] })) as {
          profiles?: TextProfile[]
        }
        const imageProfilesData = await imageProfilesRes.json().catch(() => ({ profiles: [] })) as {
          profiles?: ImageProfile[]
        }

        const nextItems = {} as Record<GeneratorTarget, GeneratorConfig>
        for (const generator of generatorsData.generators || []) {
          nextItems[generator.target_key] = generator
        }

        setItems(nextItems)
        setTextProfiles(textProfilesData.profiles || [])
        setImageProfiles(imageProfilesData.profiles || [])
        setWorkersTextModels(generatorsData.workers_ai?.text_models || [])
        setWorkersImageModels(generatorsData.workers_ai?.image_models || [])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateItem = (target: GeneratorTarget, patch: Partial<GeneratorConfig>) => {
    setItems((current) => {
      if (!current?.[target]) return current
      return {
        ...current,
        [target]: {
          ...current[target],
          ...patch,
        },
      }
    })
  }

  const saveItem = async (target: GeneratorTarget) => {
    const item = items?.[target]
    if (!item) return

    setSavingTarget(target)
    try {
      const payload = {
        target_key: item.target_key,
        prompt: item.prompt,
        provider_mode: item.provider_mode,
        text_profile_id: item.text_profile_id,
        image_profile_id: item.image_profile_id,
        workers_model: item.workers_model,
        temperature: Number(item.temperature),
        max_tokens: Number(item.max_tokens),
        aspect_ratio: item.aspect_ratio,
        resolution: item.resolution,
        is_enabled: item.is_enabled,
      }

      const res = await fetch('/api/admin/ai-post-generators', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({})) as { error?: string; generator?: GeneratorConfig }
      if (!res.ok || !data.generator) {
        throw new Error(data.error || '保存失败')
      }

      updateItem(target, data.generator)
      toast.success(`${item.label}已保存`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSavingTarget(null)
    }
  }

  const loadWorkersModels = async (target: GeneratorTarget) => {
    const kind = target === 'cover' ? 'image' : 'text'
    setLoadingWorkersModelsTarget(target)
    setWorkersModelsWarning((current) => ({ ...current, [target]: '' }))
    try {
      const res = await fetch(`/api/admin/workers-ai-models?kind=${kind}`)
      const data = await res.json().catch(() => ({})) as WorkersAiModelsResponse
      if (!res.ok) {
        throw new Error(data.error || '获取 Workers AI 模型失败')
      }

      const ids = (data.models || []).map((item) => item.id).filter(Boolean)
      if (kind === 'image') {
        setWorkersImageModels(ids)
      } else {
        setWorkersTextModels(ids)
      }

      if (data.warning) {
        setWorkersModelsWarning((current) => ({ ...current, [target]: data.warning || '' }))
        toast.warning(data.warning)
      } else {
        toast.success(`已加载 ${ids.length} 个 Workers AI 模型`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取 Workers AI 模型失败')
    } finally {
      setLoadingWorkersModelsTarget(null)
    }
  }

  if (loading || !items) {
    return <div className="py-8 text-center text-sm text-[var(--editor-muted)]">加载中…</div>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
        <h3 className="text-base font-semibold text-[var(--editor-ink)]">文章元数据 AI 生成</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--editor-muted)]">
          为摘要、标签、slug、封面分别绑定不同模型和提示词。文本字段可选择 Workers AI 或后台已配置的文本模型；封面可选择 Workers AI 图片模型或后台已配置的图片模型。
        </p>
      </div>

      {TARGET_ORDER.map((target) => {
        const item = items[target]
        if (!item) return null
        const isCover = target === 'cover'
        const workersModelOptions = buildModelOptions(
          isCover ? workersImageModels : workersTextModels,
          item.workers_model,
        )

        return (
          <section
            key={target}
            className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-base font-semibold text-[var(--editor-ink)]">{item.label}</div>
                <p className="mt-1 text-sm leading-6 text-[var(--editor-muted)]">{item.description}</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--editor-ink)]">
                <input
                  type="checkbox"
                  checked={item.is_enabled === 1}
                  onChange={(event) => updateItem(target, { is_enabled: event.target.checked ? 1 : 0 })}
                  className="h-4 w-4 rounded border-[var(--editor-line)]"
                />
                启用
              </label>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">模型来源</label>
                <select
                  value={item.provider_mode}
                  onChange={(event) => updateItem(target, {
                    provider_mode: event.target.value === 'profile' ? 'profile' : 'workers_ai',
                  })}
                  className="w-full rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                >
                  <option value="workers_ai">Workers AI</option>
                  <option value="profile">{isCover ? '已配置图片模型' : '已配置文本模型'}</option>
                </select>
              </div>

              {item.provider_mode === 'workers_ai' ? (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-[var(--editor-ink)]">Workers AI 模型</label>
                    <button
                      type="button"
                      onClick={() => void loadWorkersModels(target)}
                      disabled={loadingWorkersModelsTarget !== null}
                      className="text-xs font-medium text-[var(--editor-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingWorkersModelsTarget === target ? '拉取中…' : '拉取模型'}
                    </button>
                  </div>
                  <input
                    value={item.workers_model}
                    onChange={(event) => updateItem(target, { workers_model: event.target.value })}
                    className="w-full rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                    placeholder={isCover ? '@cf/black-forest-labs/flux-1-schnell' : '@cf/meta/llama-3.1-8b-instruct'}
                  />
                  {workersModelOptions.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      <Dropdown
                        options={workersModelOptions}
                        value={item.workers_model}
                        onChange={(value) => updateItem(target, { workers_model: value })}
                        placeholder={`搜索并选择已加载的 ${workersModelOptions.length} 个 Workers AI 模型`}
                      />
                      <div className="text-xs text-[var(--editor-muted)]">
                        已加载 {workersModelOptions.length} 个 Workers AI 模型。可在下拉里搜索，也可以直接在上方手动输入模型 ID。
                      </div>
                    </div>
                  ) : null}
                  {workersModelsWarning[target] && (
                    <div className="mt-1 text-xs leading-5 text-[var(--editor-muted)]">{workersModelsWarning[target]}</div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">
                    {isCover ? '图片模型配置' : '文本模型配置'}
                  </label>
                  <Dropdown
                    options={[
                      { value: '', label: '未绑定' },
                      ...(isCover ? imageProfileOptions : textProfileOptions),
                    ]}
                    value={String(isCover ? item.image_profile_id || '' : item.text_profile_id || '')}
                    onChange={(value) => {
                      const nextId = value ? Number(value) : null
                      updateItem(target, isCover ? { image_profile_id: nextId } : { text_profile_id: nextId })
                    }}
                    placeholder={`搜索并选择${isCover ? '图片' : '文本'}模型配置`}
                  />
                </div>
              )}

              {isCover ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">默认比例</label>
                    <select
                      value={item.aspect_ratio}
                      onChange={(event) => updateItem(target, { aspect_ratio: event.target.value as AIImageAspectRatio })}
                      className="w-full rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                    >
                      {AI_IMAGE_ASPECT_RATIO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {getAiImageAspectRatioLabel(option.value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">默认清晰度</label>
                    <select
                      value={item.resolution}
                      onChange={(event) => updateItem(target, { resolution: event.target.value as AIImageResolution })}
                      className="w-full rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                    >
                      {AI_IMAGE_RESOLUTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {getAiImageResolutionLabel(option.value)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">Temperature</label>
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={item.temperature}
                      onChange={(event) => updateItem(target, { temperature: Number(event.target.value) })}
                      className="w-full rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">Max Tokens</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={toNumericInput(item.max_tokens)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value.replace(/[^\d]/g, ''))
                        updateItem(target, { max_tokens: Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 0 })
                      }}
                      className="w-full rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">默认提示词</label>
              <textarea
                rows={isCover ? 7 : 6}
                value={item.prompt}
                onChange={(event) => updateItem(target, { prompt: event.target.value })}
                className="w-full rounded-2xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-3 text-sm leading-6 text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 text-xs text-[var(--editor-muted)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                {target === 'slug'
                  ? 'slug 强制输出英文小写，保存时仍会再次规范化。'
                  : target === 'tags'
                    ? '标签会按数组解析并自动去重。'
                    : target === 'summary'
                      ? '摘要会截断到 160 字以内。'
                      : '封面默认直接替换当前封面，可继续手动上传或再次生成。'}
              </div>
              <button
                type="button"
                onClick={() => void saveItem(target)}
                disabled={savingTarget === target}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--editor-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingTarget === target ? '保存中…' : '保存设置'}
              </button>
            </div>
          </section>
        )
      })}
    </div>
  )
}
