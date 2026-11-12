import { getSetting, setSetting } from '@/lib/repositories/settings'
import { PERSONAL_SITE } from '@/lib/personal-site'

export const PERSONAL_CONTENT_SETTING_KEY = 'personal_site_content'

export interface PersonalContent {
  hero: {
    role: string
    headline: string
    introduction: string
  }
  contact: {
    eyebrow: string
    headline: string
    description: string
  }
  about: {
    html: string
  }
}

export const DEFAULT_ABOUT_HTML = `<h2>我是谁</h2>
<p>我是 HaoRan，一名 2027 届本科生，也是一名 <strong>AI Builder</strong>。</p>
<p><strong>一个方向：成为真正理解用户、技术与商业的 AI 产品经理。</strong></p>
<p>我关注生成式 AI、用户体验与产品增长，也在持续记录产品拆解、原型实验和学习复盘。</p>
<p>我更愿意用“构建”来理解产品：先找到值得解决的问题，再把模型能力转化为清晰的交互和可验证的方案。</p>
<p><strong>产品视角。</strong> 从用户任务、使用场景和价值链路出发，判断一个 AI 产品为什么成立。</p>
<p><strong>构建视角。</strong> 用原型、实验和真实反馈推进想法，持续校准需求判断与产品方案。</p>
<p><strong>成长视角。</strong> 通过写作沉淀方法与判断，让每一次学习都能成为下一次实践的起点。</p>`

export const DEFAULT_PERSONAL_CONTENT: PersonalContent = {
  hero: {
    role: PERSONAL_SITE.role,
    headline: PERSONAL_SITE.headline,
    introduction: PERSONAL_SITE.introduction,
  },
  contact: {
    eyebrow: '2027 Campus Recruitment',
    headline: '正在寻找 AI 产品经理机会，期待与你交流。',
    description: '如果你关注生成式 AI、用户体验或产品增长，欢迎通过以下方式了解更多。',
  },
  about: {
    html: DEFAULT_ABOUT_HTML,
  },
}

type ContentSection = keyof PersonalContent
type ContentField = {
  section: ContentSection
  key: string
  label: string
  maxLength: number
}

const CONTENT_FIELDS: ContentField[] = [
  { section: 'hero', key: 'role', label: '首页身份标签', maxLength: 80 },
  { section: 'hero', key: 'headline', label: '首页主标题', maxLength: 160 },
  { section: 'hero', key: 'introduction', label: '首页简介', maxLength: 500 },
  { section: 'contact', key: 'eyebrow', label: '联系区眉题', maxLength: 100 },
  { section: 'contact', key: 'headline', label: '联系区标题', maxLength: 200 },
  { section: 'contact', key: 'description', label: '联系区说明', maxLength: 500 },
  { section: 'about', key: 'html', label: '关于页正文', maxLength: 50000 },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readStoredField(
  value: unknown,
  section: ContentSection,
  key: string,
  fallback: string,
) {
  if (!isRecord(value) || !isRecord(value[section])) return fallback
  const candidate = value[section][key]
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : fallback
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function hasVisibleText(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, '')
    .trim().length > 0
}

function readLegacyText(value: unknown, key: string, fallback: string) {
  if (!isRecord(value) || !isRecord(value.about)) return fallback
  const candidate = value.about[key]
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : fallback
}

function migrateLegacyAboutContent(value: unknown) {
  if (!isRecord(value) || !isRecord(value.about)) return DEFAULT_ABOUT_HTML
  if (typeof value.about.html === 'string' && hasVisibleText(value.about.html)) return value.about.html.trim()

  const old = value.about
  const hasLegacyFields = ['heading', 'identityPrefix', 'identityRole', 'direction', 'introduction']
    .some((key) => typeof old[key] === 'string')
  if (!hasLegacyFields) return DEFAULT_ABOUT_HTML

  const heading = readLegacyText(value, 'heading', '我是谁')
  const identityPrefix = readLegacyText(value, 'identityPrefix', '我是 HaoRan，一名 2027 届本科生，也是一名')
  const identityRole = readLegacyText(value, 'identityRole', PERSONAL_SITE.role)
  const identitySuffix = readLegacyText(value, 'identitySuffix', '。')
  const direction = readLegacyText(value, 'direction', '一个方向：成为真正理解用户、技术与商业的 AI 产品经理。')
  const introduction = readLegacyText(value, 'introduction', PERSONAL_SITE.introduction)
  const builderPhilosophy = readLegacyText(value, 'builderPhilosophy', '我更愿意用“构建”来理解产品：先找到值得解决的问题，再把模型能力转化为清晰的交互和可验证的方案。')
  const productTitle = readLegacyText(value, 'productPerspectiveTitle', '产品视角。')
  const productText = readLegacyText(value, 'productPerspective', '从用户任务、使用场景和价值链路出发，判断一个 AI 产品为什么成立。')
  const builderTitle = readLegacyText(value, 'builderPerspectiveTitle', '构建视角。')
  const builderText = readLegacyText(value, 'builderPerspective', '用原型、实验和真实反馈推进想法，持续校准需求判断与产品方案。')
  const growthTitle = readLegacyText(value, 'growthPerspectiveTitle', '成长视角。')
  const growthText = readLegacyText(value, 'growthPerspective', '通过写作沉淀方法与判断，让每一次学习都能成为下一次实践的起点。')

  return `<h2>${escapeHtml(heading)}</h2>
<p>${escapeHtml(identityPrefix)} <strong>${escapeHtml(identityRole)}</strong>${escapeHtml(identitySuffix)}</p>
<p><strong>${escapeHtml(direction)}</strong></p>
<p>${escapeHtml(introduction)}</p>
<p>${escapeHtml(builderPhilosophy)}</p>
<p><strong>${escapeHtml(productTitle)}</strong> ${escapeHtml(productText)}</p>
<p><strong>${escapeHtml(builderTitle)}</strong> ${escapeHtml(builderText)}</p>
<p><strong>${escapeHtml(growthTitle)}</strong> ${escapeHtml(growthText)}</p>`
}

export function normalizePersonalContent(value: unknown): PersonalContent {
  const content = structuredClone(DEFAULT_PERSONAL_CONTENT)
  for (const field of CONTENT_FIELDS.filter((item) => item.section !== 'about')) {
    const section = content[field.section] as unknown as Record<string, string>
    section[field.key] = readStoredField(value, field.section, field.key, section[field.key])
  }
  content.about.html = migrateLegacyAboutContent(value)
  return content
}

export class PersonalContentValidationError extends Error {}

export function parsePersonalContentInput(value: unknown): PersonalContent {
  if (!isRecord(value)) throw new PersonalContentValidationError('文案数据格式不正确')
  const content = structuredClone(DEFAULT_PERSONAL_CONTENT)

  for (const field of CONTENT_FIELDS) {
    const inputSection = value[field.section]
    if (!isRecord(inputSection)) {
      throw new PersonalContentValidationError(`${field.label}格式不正确`)
    }
    const candidate = inputSection[field.key]
    if (typeof candidate !== 'string') {
      throw new PersonalContentValidationError(`${field.label}格式不正确`)
    }
    const text = candidate.trim()
    if (!text) throw new PersonalContentValidationError(`${field.label}不能为空`)
    if (field.section === 'about' && field.key === 'html' && !hasVisibleText(text)) {
      throw new PersonalContentValidationError('关于页正文不能为空')
    }
    if (text.length > field.maxLength) {
      throw new PersonalContentValidationError(`${field.label}内容过长`)
    }
    const section = content[field.section] as unknown as Record<string, string>
    section[field.key] = text
  }

  return content
}

export async function getPersonalContent(db: D1Database): Promise<PersonalContent> {
  const stored = await getSetting(db, PERSONAL_CONTENT_SETTING_KEY)
  if (!stored) return structuredClone(DEFAULT_PERSONAL_CONTENT)
  try {
    return normalizePersonalContent(JSON.parse(stored))
  } catch {
    return structuredClone(DEFAULT_PERSONAL_CONTENT)
  }
}

export async function savePersonalContent(db: D1Database, content: PersonalContent) {
  await setSetting(db, PERSONAL_CONTENT_SETTING_KEY, JSON.stringify(content))
}
