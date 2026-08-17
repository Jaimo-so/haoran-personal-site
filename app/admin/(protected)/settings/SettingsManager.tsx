'use client'

import { useState } from 'react'
import { Tabs } from '@/components/Tabs'
import type { RuntimeCapabilities } from '@/lib/runtime-capabilities'
import { normalizeTheme, type BodyFont, type Theme } from '@/lib/appearance'
import { NavLinksEditor } from './NavLinksEditor'
import { CustomJsEditor } from './CustomJsEditor'
import { ThemeManager } from './ThemeManager'
import { CategoryManager } from '../categories/CategoryManager'
import { AiProviderManager } from './AiProviderManager'
import { AiActionsManager } from './AiActionsManager'
import { AiImageProviderManager } from './AiImageProviderManager'
import { AiImageActionsManager } from './AiImageActionsManager'
import { AiPostGeneratorsManager } from './AiPostGeneratorsManager'
import { RuntimeCapabilitiesPanel } from './RuntimeCapabilitiesPanel'
import { ThirdPartyPublishingManager } from './ThirdPartyPublishingManager'

interface Category {
  name: string
  slug: string
  post_count: number
}

interface Props {
  initialNavLinks: string
  initialCustomJs: string
  initialCategories: Category[]
  initialBodyFont: string
  initialDefaultTheme: string
  initialRuntimeCapabilities: RuntimeCapabilities
}

export function SettingsManager({
  initialNavLinks,
  initialCustomJs,
  initialCategories,
  initialBodyFont,
  initialDefaultTheme,
  initialRuntimeCapabilities,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const persistSetting = async (key: string, value: string) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (!res.ok) throw new Error('保存失败')
  }

  const save = async (key: string, value: string) => {
    setSaving(true)
    setMsg('')
    try {
      await persistSetting(key, value)
      setMsg('已保存')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveThemeSettings = async ({ theme, font }: { theme: Theme; font: BodyFont }) => {
    setSaving(true)
    setMsg('')
    try {
      await Promise.all([
        persistSetting('default_theme', theme),
        persistSetting('body_font', font),
      ])
      setMsg('已保存')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    {
      id: 'nav',
      label: '导航设置',
      content: (
        <div className="space-y-4">
          {msg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              {msg}
            </div>
          )}
          <NavLinksEditor
            initialValue={initialNavLinks}
            onSave={(val) => save('nav_links', val)}
            saving={saving}
          />
        </div>
      ),
    },
    {
      id: 'categories',
      label: '分类设置',
      content: <CategoryManager initialCategories={initialCategories} />,
    },
    {
      id: 'code',
      label: '自定义代码',
      content: (
        <div className="space-y-4">
          {msg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              {msg}
            </div>
          )}
          <p className="text-sm text-[var(--editor-muted)]">
            此代码会注入到所有页面的 &lt;head&gt; 中，适合添加统计代码（如 Google Analytics、百度统计等）。
          </p>
          <CustomJsEditor
            initialValue={initialCustomJs}
            onSave={(val) => save('custom_js', val)}
            saving={saving}
          />
        </div>
      ),
    },
    {
      id: 'theme',
      label: '主题管理',
      content: (
        <ThemeManager
          initialTheme={normalizeTheme(initialDefaultTheme)}
          initialFont={(initialBodyFont || 'default') as BodyFont}
          onSave={saveThemeSettings}
          saving={saving}
        />
      ),
    },
    {
      id: 'tokens',
      label: '第三方发布',
      content: <ThirdPartyPublishingManager />,
    },
    {
      id: 'ai-provider',
      label: 'AI 模型',
      content: <AiProviderManager />,
    },
    {
      id: 'ai-actions',
      label: 'AI 操作',
      content: <AiActionsManager />,
    },
    {
      id: 'ai-image-provider',
      label: '图片模型',
      content: <AiImageProviderManager />,
    },
    {
      id: 'ai-image-actions',
      label: '图片提示',
      content: <AiImageActionsManager />,
    },
    {
      id: 'ai-post-generators',
      label: '文章生成',
      content: <AiPostGeneratorsManager />,
    },
    {
      id: 'runtime',
      label: '运行环境',
      content: <RuntimeCapabilitiesPanel capabilities={initialRuntimeCapabilities} />,
    },
  ]

  return <Tabs tabs={tabs} defaultTab="nav" />
}
