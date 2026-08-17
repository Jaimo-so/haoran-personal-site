import {
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
  normalizeBaseUrl,
} from '@/lib/ai-provider-profiles'
import {
  deriveLegacyQualityFromResolution,
  deriveLegacySizeFromAspectRatio,
  inferAspectRatioFromLegacySize,
  inferResolutionFromLegacyQuality,
  type AIImageAspectRatio,
  type AIImageResolution,
} from '@/lib/ai-image-options'

export interface AIImageProviderProfileRow {
  id: number
  name: string
  provider: string
  provider_name: string
  provider_type: string
  provider_category: string
  api_key_url: string
  base_url: string
  model: string
  api_key_encrypted: string
  api_key_masked: string
  is_default: number
  created_at: number
  updated_at: number
}

export interface AIImageActionRow {
  id: number
  action_key: string
  label: string
  description: string
  prompt: string
  aspect_ratio: AIImageAspectRatio
  resolution: AIImageResolution
  size: string
  quality: string
  profile_id: number | null
  sort_order: number
  is_enabled: number
  is_builtin: number
  created_at: number
  updated_at: number
}

interface DefaultImageActionSeed {
  action_key: string
  label: string
  description: string
  prompt: string
  aspect_ratio: AIImageAspectRatio
  resolution: AIImageResolution
  size: string
  quality: string
  sort_order: number
}

const DEFAULT_IMAGE_ACTIONS: DefaultImageActionSeed[] = [
  {
    action_key: 'mondo_landscape',
    label: 'Mondo 横版配图',
    description: '16:9 文章主图或章节头图',
    prompt:
      '将主题重构为 Mondo 风格横版概念海报：screen print aesthetic，limited 3-4 color palette，flat color blocks，symbolic storytelling，negative space，bold contrast，vintage poster finish。画面要克制、有主视觉中心，不要堆砌元素。除非用户明确要求，不要出现可读文字、logo、水印。',
    aspect_ratio: '16:9',
    resolution: '2k',
    size: '1536x1024',
    quality: 'high',
    sort_order: 10,
  },
  {
    action_key: 'mondo_portrait',
    label: 'Mondo 竖版海报',
    description: '9:16 强视觉封面或人物海报',
    prompt:
      '将主题转化为 Mondo 风格竖版海报：alternative movie poster，screen print feel，strong silhouette，minimalist symbolism，retro print texture，dramatic negative space。优先做单一焦点和强构图。除非用户明确要求，不要出现可读文字、logo、水印。',
    aspect_ratio: '9:16',
    resolution: '2k',
    size: '1024x1536',
    quality: 'high',
    sort_order: 20,
  },
  {
    action_key: 'chapter_illustration',
    label: '章节插图',
    description: '留白更多，适合正文中穿插',
    prompt:
      '生成一张适合作为中文长文章节插图的概念图。保持 Mondo 系列的 screen print 质感与象征性表达，但减少海报感，多一些留白和阅读友好度。构图简洁、主题明确、氛围统一。除非用户明确要求，不要出现可读文字、logo、水印。',
    aspect_ratio: '4:3',
    resolution: '2k',
    size: '1536x1024',
    quality: 'medium',
    sort_order: 30,
  },
  {
    action_key: 'book_cover_concept',
    label: '书封概念图',
    description: '适合书单、读书笔记或封面灵感',
    prompt:
      '生成一张书籍封面概念图，强调 Mondo 系列常见的象征元素、有限色盘、印刷颗粒和复古张力。画面适合 2D 平面设计再加工。主体要明确，边界干净，保留封面排版空间。除非用户明确要求，不要出现可读文字、logo、水印。',
    aspect_ratio: '2:3',
    resolution: '4k',
    size: '1024x1536',
    quality: 'high',
    sort_order: 40,
  },
]

export async function ensureAiImageProviderProfilesTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_image_provider_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'custom',
      provider_name TEXT NOT NULL DEFAULT '',
      provider_type TEXT NOT NULL DEFAULT 'openai_images',
      provider_category TEXT NOT NULL DEFAULT '',
      api_key_url TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      api_key_masked TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `).run()
}

async function ensureAiImageActionsTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_image_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT 'auto',
      resolution TEXT NOT NULL DEFAULT 'auto',
      size TEXT NOT NULL DEFAULT 'auto',
      quality TEXT NOT NULL DEFAULT 'auto',
      profile_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      is_builtin INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `).run()

  const tableInfo = await db.prepare('PRAGMA table_info(ai_image_actions)').all<{ name: string }>()
  const columns = new Set((tableInfo.results || []).map((column) => column.name))
  const hadAspectRatioColumn = columns.has('aspect_ratio')
  const hadResolutionColumn = columns.has('resolution')

  if (!columns.has('aspect_ratio')) {
    await db.prepare("ALTER TABLE ai_image_actions ADD COLUMN aspect_ratio TEXT NOT NULL DEFAULT 'auto'").run()
  }
  if (!columns.has('resolution')) {
    await db.prepare("ALTER TABLE ai_image_actions ADD COLUMN resolution TEXT NOT NULL DEFAULT 'auto'").run()
  }

  if (!columns.has('size')) {
    await db.prepare("ALTER TABLE ai_image_actions ADD COLUMN size TEXT NOT NULL DEFAULT 'auto'").run()
  }
  if (!columns.has('quality')) {
    await db.prepare("ALTER TABLE ai_image_actions ADD COLUMN quality TEXT NOT NULL DEFAULT 'auto'").run()
  }
  if (!columns.has('profile_id')) {
    await db.prepare('ALTER TABLE ai_image_actions ADD COLUMN profile_id INTEGER').run()
  }

  if (!hadAspectRatioColumn || !hadResolutionColumn) {
    const { results } = await db.prepare(`
      SELECT id, action_key, size, quality
      FROM ai_image_actions
    `).all<Pick<AIImageActionRow, 'id' | 'action_key' | 'size' | 'quality'>>()

    for (const row of results || []) {
      const seeded = DEFAULT_IMAGE_ACTIONS.find((item) => item.action_key === row.action_key)
      const aspectRatio = seeded?.aspect_ratio || inferAspectRatioFromLegacySize(row.size)
      const resolution = seeded?.resolution || inferResolutionFromLegacyQuality(row.quality)

      await db.prepare(`
        UPDATE ai_image_actions
        SET aspect_ratio = ?, resolution = ?, updated_at = strftime('%s', 'now')
        WHERE id = ?
      `).bind(aspectRatio, resolution, row.id).run()
    }
  }

  const countRow = await db.prepare('SELECT COUNT(*) as count FROM ai_image_actions').first<{ count: number }>()
  if ((countRow?.count ?? 0) > 0) return

  for (const seed of DEFAULT_IMAGE_ACTIONS) {
    await db.prepare(`
      INSERT INTO ai_image_actions (
        action_key, label, description, prompt, aspect_ratio, resolution, size, quality, sort_order, is_builtin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      seed.action_key,
      seed.label,
      seed.description,
      seed.prompt,
      seed.aspect_ratio,
      seed.resolution,
      deriveLegacySizeFromAspectRatio(seed.aspect_ratio, seed.size),
      deriveLegacyQualityFromResolution(seed.resolution, seed.quality),
      seed.sort_order,
    ).run()
  }
}

export function getDefaultImageActionSeed(actionKey?: string) {
  if (!actionKey) return null
  return DEFAULT_IMAGE_ACTIONS.find((seed) => seed.action_key === actionKey) || null
}

export async function ensureDefaultImageProfileId(db: D1Database): Promise<number | null> {
  const defaultRow = await db.prepare(`
    SELECT id FROM ai_image_provider_profiles
    WHERE is_default = 1
    ORDER BY id ASC
    LIMIT 1
  `).first<{ id: number }>()
  if (defaultRow?.id) return defaultRow.id

  const firstRow = await db.prepare(`
    SELECT id FROM ai_image_provider_profiles
    ORDER BY id ASC
    LIMIT 1
  `).first<{ id: number }>()
  if (!firstRow?.id) return null

  await db.prepare('UPDATE ai_image_provider_profiles SET is_default = 0').run()
  await db.prepare(`
    UPDATE ai_image_provider_profiles
    SET is_default = 1, updated_at = strftime('%s', 'now')
    WHERE id = ?
  `).bind(firstRow.id).run()

  return firstRow.id
}

export async function ensureAiImageConfigInfrastructure(
  db: D1Database,
): Promise<void> {
  await ensureAiImageProviderProfilesTable(db)
  await ensureAiImageActionsTable(db)

  const defaultProfileId = await ensureDefaultImageProfileId(db)
  if (defaultProfileId) {
    await db.prepare(`
      UPDATE ai_image_actions
      SET profile_id = ?
      WHERE profile_id IS NULL
    `).bind(defaultProfileId).run()
  }
}

export async function resolveAiImageProfileConfig(
  db: D1Database,
  secret: string,
  profileId?: number,
): Promise<{
  id: number
  name: string
  provider: string
  provider_name: string
  provider_type: string
  provider_category: string
  api_key_url: string
  base_url: string
  model: string
  api_key: string
  api_key_masked: string
  is_default: number
} | null> {
  await ensureAiImageConfigInfrastructure(db)

  const selected = Number.isFinite(profileId) && Number(profileId) > 0
    ? await db.prepare(`
        SELECT *
        FROM ai_image_provider_profiles
        WHERE id = ?
        LIMIT 1
      `).bind(Number(profileId)).first<AIImageProviderProfileRow>()
    : await db.prepare(`
        SELECT *
        FROM ai_image_provider_profiles
        ORDER BY is_default DESC, id ASC
        LIMIT 1
      `).first<AIImageProviderProfileRow>()

  if (!selected?.base_url || !selected.model) return null

  const apiKey = await decryptApiKey(selected.api_key_encrypted || '', secret)
  if (!apiKey) return null

  return {
    id: selected.id,
    name: selected.name,
    provider: selected.provider,
    provider_name: selected.provider_name,
    provider_type: selected.provider_type,
    provider_category: selected.provider_category,
    api_key_url: selected.api_key_url,
    base_url: normalizeBaseUrl(selected.base_url),
    model: selected.model,
    api_key: apiKey,
    api_key_masked: selected.api_key_masked,
    is_default: selected.is_default,
  }
}

export async function saveEncryptedAiImageApiKey(
  apiKey: string,
  secret: string,
): Promise<{ encrypted: string; masked: string }> {
  const normalized = apiKey.trim()
  if (!normalized) {
    return { encrypted: '', masked: '' }
  }

  return {
    encrypted: await encryptApiKey(normalized, secret),
    masked: maskApiKey(normalized),
  }
}
