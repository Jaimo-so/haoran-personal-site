export const THEME_STORAGE_KEY = 'qm_site_theme'
export const THEME_CHANGE_EVENT = 'qm-theme-change'

export const THEME_OPTIONS = [
  {
    id: 'refined',
    label: '精致极简',
    description: '克制、留白充足的个人作品与写作界面',
  },
] as const

export type Theme = 'default' | 'refined' | 'editorial' | 'terminal'

export const FONT_PRESETS = [
  {
    id: 'default',
    name: '系统默认',
    desc: '本地 Geist + 系统字体',
    family: '',
    needsLoad: false,
  },
  {
    id: 'kaiti',
    name: '楷体（tw93风格）',
    desc: '仓耳今楷02，典雅文艺，自托管分片加载',
    family: 'TsangerJinKai02, STKaiti, KaiTi, serif',
    needsLoad: true,
  },
  {
    id: 'serif',
    name: '衬线体',
    desc: 'Georgia + Noto Serif SC',
    family: 'Georgia, "Noto Serif SC", "Source Han Serif SC", serif',
    needsLoad: false,
  },
  {
    id: 'heiti',
    name: '黑体',
    desc: '苹方 / 微软雅黑',
    family: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    needsLoad: false,
  },
] as const

export type BodyFont = (typeof FONT_PRESETS)[number]['id']

export const FONT_CONFIG: Record<string, { family: string; link?: string }> = {
  kaiti: {
    family: 'TsangerJinKai02, STKaiti, KaiTi, serif',
    link: '/fonts/jinkai/jinkai.css',
  },
  serif: { family: 'Georgia, "Noto Serif SC", "Source Han Serif SC", serif' },
  heiti: { family: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' },
}

export function isTheme(value: string | null | undefined): value is Theme {
  return THEME_OPTIONS.some((option) => option.id === value)
}

export function normalizeTheme(value: string | null | undefined, fallback: Theme = 'refined'): Theme {
  return isTheme(value) ? value : fallback
}

export function getClientThemePreference(fallback: Theme): Theme {
  if (typeof window === 'undefined') return fallback

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (isTheme(saved)) return saved

  const attr = document.documentElement.getAttribute('data-theme')
  if (isTheme(attr)) return attr

  return fallback
}

export function subscribeToThemeChange(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = () => onStoreChange()
  window.addEventListener(THEME_CHANGE_EVENT, handler)

  return () => window.removeEventListener(THEME_CHANGE_EVENT, handler)
}
