export const MANAGED_TOOL_ICONS = ['globe', 'book', 'bot', 'blocks', 'code'] as const

export type ManagedToolIcon = (typeof MANAGED_TOOL_ICONS)[number]

export interface ManagedTool {
  id: number
  name: string
  category: string
  description: string
  link_url: string
  icon: ManagedToolIcon
  sort_order: number
  is_visible: number
  created_at: number
  updated_at: number
}

export interface ManagedToolInput {
  name: string
  category: string
  description: string
  link_url: string
  icon: ManagedToolIcon
  is_visible: number
}

const DEFAULT_TOOLS: ManagedToolInput[] = [
  {
    name: '网页剪藏工具',
    category: 'Chrome 扩展',
    description: '从 Chrome 提取网页正文与图片，并一键保存到博客草稿箱。',
    link_url: 'https://github.com/Jaimo-so/haoran-personal-site/tree/main/ecosystem/chrome-clipper',
    icon: 'globe',
    is_visible: 1,
  },
  {
    name: 'Obsidian 发布工具',
    category: 'Obsidian 插件',
    description: '把 Obsidian 笔记及本地媒体文件直接发布到博客草稿箱。',
    link_url: 'https://github.com/Jaimo-so/haoran-personal-site/tree/main/ecosystem/obsidian-publisher',
    icon: 'book',
    is_visible: 1,
  },
  {
    name: 'AI 发布 Skill',
    category: 'AI Skill',
    description: '通过 AI 或命令工作流发布 Markdown、纯文本和网页内容。',
    link_url: 'https://github.com/Jaimo-so/haoran-personal-site/tree/main/ecosystem/qiaomu-blog-publish-skill',
    icon: 'bot',
    is_visible: 1,
  },
]

let infrastructureReady = false

export async function ensureManagedToolsInfrastructure(db: D1Database) {
  if (infrastructureReady) return

  const existing = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'managed_tools'")
    .first<{ name: string }>()

  if (!existing) {
    await db.prepare(`
      CREATE TABLE managed_tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '开发工具',
        description TEXT NOT NULL DEFAULT '',
        link_url TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL DEFAULT 'globe',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_visible INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `).run()
    await db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_managed_tools_sort ON managed_tools(sort_order, id)'
    ).run()

    for (const [index, tool] of DEFAULT_TOOLS.entries()) {
      await db.prepare(`
        INSERT INTO managed_tools
          (name, category, description, link_url, icon, sort_order, is_visible)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tool.name,
        tool.category,
        tool.description,
        tool.link_url,
        tool.icon,
        (index + 1) * 10,
        tool.is_visible,
      ).run()
    }
  }

  infrastructureReady = true
}

export async function getManagedTools(db: D1Database): Promise<ManagedTool[]> {
  await ensureManagedToolsInfrastructure(db)
  const { results } = await db.prepare(`
    SELECT id, name, category, description, link_url, icon, sort_order,
           is_visible, created_at, updated_at
    FROM managed_tools
    ORDER BY sort_order ASC, id ASC
  `).all<ManagedTool>()
  return results
}

export async function getManagedTool(db: D1Database, id: number): Promise<ManagedTool | null> {
  await ensureManagedToolsInfrastructure(db)
  return await db.prepare(`
    SELECT id, name, category, description, link_url, icon, sort_order,
           is_visible, created_at, updated_at
    FROM managed_tools
    WHERE id = ?
  `).bind(id).first<ManagedTool>()
}

export async function createManagedTool(db: D1Database, input: ManagedToolInput): Promise<ManagedTool> {
  await ensureManagedToolsInfrastructure(db)
  const row = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM managed_tools')
    .first<{ max_sort: number }>()
  const result = await db.prepare(`
    INSERT INTO managed_tools
      (name, category, description, link_url, icon, sort_order, is_visible)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.name,
    input.category,
    input.description,
    input.link_url,
    input.icon,
    (row?.max_sort ?? 0) + 10,
    input.is_visible,
  ).run()

  const created = await getManagedTool(db, Number(result.meta.last_row_id))
  if (!created) throw new Error('工具创建后读取失败')
  return created
}

export async function updateManagedTool(
  db: D1Database,
  id: number,
  updates: Partial<ManagedToolInput>,
): Promise<ManagedTool | null> {
  await ensureManagedToolsInfrastructure(db)
  const sets: string[] = []
  const values: Array<string | number> = []

  for (const field of ['name', 'category', 'description', 'link_url', 'icon', 'is_visible'] as const) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = ?`)
      values.push(updates[field])
    }
  }

  if (sets.length === 0) return getManagedTool(db, id)
  sets.push("updated_at = strftime('%s', 'now')")
  values.push(id)

  await db.prepare(`UPDATE managed_tools SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()
  return getManagedTool(db, id)
}

export async function deleteManagedTool(db: D1Database, id: number): Promise<boolean> {
  await ensureManagedToolsInfrastructure(db)
  const existing = await getManagedTool(db, id)
  if (!existing) return false
  await db.prepare('DELETE FROM managed_tools WHERE id = ?').bind(id).run()
  return true
}

export async function reorderManagedTools(db: D1Database, ids: number[]): Promise<void> {
  await ensureManagedToolsInfrastructure(db)
  for (const [index, id] of ids.entries()) {
    await db.prepare(
      "UPDATE managed_tools SET sort_order = ?, updated_at = strftime('%s', 'now') WHERE id = ?"
    ).bind((index + 1) * 10, id).run()
  }
}

export function parseManagedToolInput(value: unknown, partial = false): Partial<ManagedToolInput> {
  if (!value || typeof value !== 'object') throw new Error('请求数据格式不正确')
  const body = value as Record<string, unknown>
  const parsed: Partial<ManagedToolInput> = {}

  const readText = (key: keyof ManagedToolInput, maxLength: number, required: boolean) => {
    const raw = body[key]
    if (raw === undefined && partial) return
    if (typeof raw !== 'string') {
      if (required) throw new Error(`${key} 不能为空`)
      parsed[key] = '' as never
      return
    }
    const text = raw.trim()
    if (required && !text) throw new Error(`${key} 不能为空`)
    if (text.length > maxLength) throw new Error(`${key} 内容过长`)
    parsed[key] = text as never
  }

  readText('name', 80, true)
  readText('category', 40, true)
  readText('description', 500, false)
  readText('link_url', 1000, true)

  if (parsed.link_url) {
    let url: URL
    try {
      url = new URL(parsed.link_url)
    } catch {
      throw new Error('请输入有效的工具链接')
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('工具链接必须以 http:// 或 https:// 开头')
    }
    parsed.link_url = url.toString()
  }

  if (body.icon !== undefined || !partial) {
    if (typeof body.icon !== 'string' || !MANAGED_TOOL_ICONS.includes(body.icon as ManagedToolIcon)) {
      throw new Error('请选择有效的工具图标')
    }
    parsed.icon = body.icon as ManagedToolIcon
  }

  if (body.is_visible !== undefined || !partial) {
    parsed.is_visible = body.is_visible === 0 || body.is_visible === false ? 0 : 1
  }

  return parsed
}
