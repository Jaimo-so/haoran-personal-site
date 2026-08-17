'use client'

import type { RuntimeCapabilities } from '@/lib/runtime-capabilities'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active
          ? 'bg-emerald-500/10 text-emerald-700'
          : 'bg-slate-500/10 text-slate-600'
      }`}
    >
      {active ? '可用' : '未绑定'}
    </span>
  )
}

function FeatureBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        enabled
          ? 'bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
          : 'bg-amber-500/10 text-amber-700'
      }`}
    >
      {enabled ? '已启用' : '已降级'}
    </span>
  )
}

export function RuntimeCapabilitiesPanel({ capabilities }: { capabilities: RuntimeCapabilities }) {
  const bindingItems = [
    { key: 'd1', label: 'D1', active: capabilities.bindings.d1 },
    { key: 'cache', label: 'KV Cache', active: capabilities.bindings.cache },
    { key: 'images', label: 'R2 Images', active: capabilities.bindings.images },
    { key: 'queue', label: 'Queues', active: capabilities.bindings.queue },
    { key: 'workersAI', label: 'Workers AI', active: capabilities.bindings.workersAI },
    { key: 'vectorize', label: 'Vectorize', active: capabilities.bindings.vectorize },
  ]

  const featureItems = [
    {
      key: 'asyncJobs',
      label: '异步后台任务',
      enabled: capabilities.features.asyncJobs.enabled,
      strategy: capabilities.features.asyncJobs.strategy,
      note: capabilities.features.asyncJobs.note,
    },
    {
      key: 'aiInference',
      label: 'AI 推理链路',
      enabled: capabilities.features.aiInference.enabled,
      strategy: capabilities.features.aiInference.strategy,
      note: capabilities.features.aiInference.note,
    },
    {
      key: 'mediaPipeline',
      label: '图片处理链路',
      enabled: capabilities.features.mediaPipeline.enabled,
      strategy: capabilities.features.mediaPipeline.strategy,
      note: capabilities.features.mediaPipeline.note,
    },
    {
      key: 'relatedContent',
      label: '相关文章召回',
      enabled: capabilities.features.relatedContent.enabled,
      strategy: capabilities.features.relatedContent.strategy,
      note: capabilities.features.relatedContent.note,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4">
        <div className="mb-3 text-sm font-semibold text-[var(--editor-ink)]">运行时绑定探测</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bindingItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2">
              <span className="text-sm text-[var(--editor-ink)]">{item.label}</span>
              <StatusBadge active={item.active} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4">
        <div className="mb-3 text-sm font-semibold text-[var(--editor-ink)]">增强能力与回退策略</div>
        <div className="space-y-3">
          {featureItems.map((item) => (
            <div key={item.key} className="rounded-lg border border-[var(--editor-line)] bg-[var(--background)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[var(--editor-ink)]">{item.label}</div>
                <FeatureBadge enabled={item.enabled} />
              </div>
              <div className="mt-1 text-xs text-[var(--editor-muted)]">当前策略：`{item.strategy}`</div>
              <div className="mt-2 text-sm text-[var(--editor-muted)]">{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-[var(--editor-line)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--editor-muted)]">
        开源部署建议：默认只要求 `D1 + R2` 即可运行，`Queues / Workers AI / Vectorize` 都应作为可选增强，通过环境变量显式开启。
      </div>
    </div>
  )
}
