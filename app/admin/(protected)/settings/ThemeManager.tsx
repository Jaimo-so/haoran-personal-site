'use client'

import { useState } from 'react'
import { FONT_PRESETS, THEME_OPTIONS, type BodyFont, type Theme } from '@/lib/appearance'

interface Props {
  initialTheme: Theme
  initialFont: BodyFont
  onSave: (values: { theme: Theme; font: BodyFont }) => void | Promise<void>
  saving: boolean
}

export function ThemeManager({ initialTheme, initialFont, onSave, saving }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(initialTheme)
  const [selectedFont, setSelectedFont] = useState<BodyFont>(initialFont)

  const currentFont = FONT_PRESETS.find((preset) => preset.id === selectedFont) || FONT_PRESETS[0]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-base font-medium text-[var(--editor-ink)]">默认主题</h3>
        <p className="text-sm text-[var(--editor-muted)]">
          这里设置的是网站首次访问时的默认主题。访客后续如果自己切换主题，会优先使用本地保存的偏好。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map((theme) => (
            <label
              key={theme.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                selectedTheme === theme.id
                  ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/5'
                  : 'border-[var(--editor-line)] bg-[var(--editor-panel)] hover:border-[var(--editor-soft)]'
              }`}
            >
              <input
                type="radio"
                name="default-theme"
                value={theme.id}
                checked={selectedTheme === theme.id}
                onChange={() => setSelectedTheme(theme.id)}
                className="mt-1 accent-[var(--editor-accent)]"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--editor-ink)]">{theme.label}</div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--editor-muted)]">{theme.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-medium text-[var(--editor-ink)]">正文字体</h3>
        <p className="text-sm text-[var(--editor-muted)]">
          设置前台文章正文的字体。主题控制首页风格，字体控制阅读正文体验。
        </p>
        <div className="grid gap-3">
          {FONT_PRESETS.map((preset) => (
            <label
              key={preset.id}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                selectedFont === preset.id
                  ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/5'
                  : 'border-[var(--editor-line)] bg-[var(--editor-panel)] hover:border-[var(--editor-soft)]'
              }`}
            >
              <input
                type="radio"
                name="body-font"
                value={preset.id}
                checked={selectedFont === preset.id}
                onChange={() => setSelectedFont(preset.id)}
                className="mt-1 accent-[var(--editor-accent)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--editor-ink)]">{preset.name}</span>
                  <span className="text-xs text-[var(--stone-gray)]">{preset.desc}</span>
                </div>
                <p
                  className="mt-1 text-sm leading-relaxed text-[var(--editor-muted)]"
                  style={{ fontFamily: preset.family || 'inherit' }}
                >
                  白日依山尽，黄河入海流。The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {currentFont.needsLoad && (
        <p className="text-xs text-[var(--stone-gray)]">
          当前字体需要从 CDN 加载（约 4MB），首次加载后会被浏览器缓存。
        </p>
      )}

      <button
        onClick={() => void onSave({ theme: selectedTheme, font: selectedFont })}
        disabled={saving}
        className="rounded-lg bg-[var(--editor-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-105 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存主题管理设置'}
      </button>
    </div>
  )
}
