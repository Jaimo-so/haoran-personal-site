export interface ManagedProjectInput {
  name: string
  description: string
  link_url: string
  github_url: string
  is_visible: number
}

export interface ManagedProject extends ManagedProjectInput {
  id: number
  sort_order: number
  created_at: number
  updated_at: number
}

export const DEFAULT_PROJECTS: ManagedProjectInput[] = [
  {
    name: 'AI 产品拆解',
    description: '从用户问题、交互路径和商业价值出发，理解一个 AI 产品为什么成立。',
    link_url: '',
    github_url: '',
    is_visible: 1,
  },
  {
    name: '原型与实验',
    description: '把想法变成可验证的原型，用真实反馈校准需求判断与产品方案。',
    link_url: '',
    github_url: '',
    is_visible: 1,
  },
  {
    name: '学习与复盘',
    description: '记录模型能力、行业认知与求职实践，沉淀可复用的方法和判断。',
    link_url: '',
    github_url: '',
    is_visible: 1,
  },
]

const initialization = new WeakMap<D1Database, Promise<void>>()
const INITIALIZED_KEY = 'managed_projects_initialized'

export async function ensureManagedProjectsInfrastructure(db: D1Database): Promise<void> {
  const pending = initialization.get(db)
  if (pending) return pending

  const task = (async () => {
    const initialized = await db.prepare('SELECT value FROM site_settings WHERE key = ?')
      .bind(INITIALIZED_KEY).first<{ value: string }>()
    if (initialized) return

    // D1 batches are transactional. The marker prevents deleted defaults from returning,
    // including when multiple requests initialize the database at the same time.
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS managed_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        link_url TEXT NOT NULL DEFAULT '',
        github_url TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0, 1)),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_managed_projects_sort ON managed_projects(sort_order, id)'),
      ...DEFAULT_PROJECTS.map((project, index) => db.prepare(`
        INSERT OR IGNORE INTO managed_projects (id, name, description, link_url, sort_order, is_visible)
        SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = ?)
      `).bind(index + 1, project.name, project.description, project.link_url, (index + 1) * 10, project.is_visible, INITIALIZED_KEY)),
      db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)').bind(INITIALIZED_KEY, '1'),
    ])
  })()
  initialization.set(db, task)
  try {
    await task
  } catch (error) {
    initialization.delete(db)
    throw error
  }
}

export async function getManagedProjects(db: D1Database): Promise<ManagedProject[]> {
  await ensureManagedProjectsInfrastructure(db)
  const { results } = await db.prepare('SELECT * FROM managed_projects ORDER BY sort_order ASC, id ASC').all<ManagedProject>()
  return results
}

export async function getManagedProject(db: D1Database, id: number): Promise<ManagedProject | null> {
  await ensureManagedProjectsInfrastructure(db)
  return db.prepare('SELECT * FROM managed_projects WHERE id = ?').bind(id).first<ManagedProject>()
}

export async function createManagedProject(db: D1Database, input: ManagedProjectInput): Promise<ManagedProject> {
  await ensureManagedProjectsInfrastructure(db)
  const project = await db.prepare(`
    INSERT INTO managed_projects (name, description, link_url, github_url, sort_order, is_visible)
    SELECT ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 10, ? FROM managed_projects
    RETURNING *
  `).bind(input.name, input.description, input.link_url, input.github_url, input.is_visible).first<ManagedProject>()
  if (!project) throw new Error('项目创建后读取失败')
  return project
}

export async function updateManagedProject(db: D1Database, id: number, updates: Partial<ManagedProjectInput>): Promise<ManagedProject | null> {
  await ensureManagedProjectsInfrastructure(db)
  const sets: string[] = []
  const values: Array<string | number> = []
  for (const field of ['name', 'description', 'link_url', 'github_url', 'is_visible'] as const) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = ?`)
      values.push(updates[field])
    }
  }
  if (!sets.length) return getManagedProject(db, id)
  return db.prepare(`UPDATE managed_projects SET ${sets.join(', ')}, updated_at = strftime('%s', 'now') WHERE id = ? RETURNING *`)
    .bind(...values, id).first<ManagedProject>()
}

export async function deleteManagedProject(db: D1Database, id: number): Promise<boolean> {
  await ensureManagedProjectsInfrastructure(db)
  const result = await db.prepare('DELETE FROM managed_projects WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}

export async function reorderManagedProjects(db: D1Database, ids: number[]): Promise<void> {
  await ensureManagedProjectsInfrastructure(db)
  await db.batch(ids.map((id, index) => db.prepare(
    "UPDATE managed_projects SET sort_order = ?, updated_at = strftime('%s', 'now') WHERE id = ?",
  ).bind((index + 1) * 10, id)))
}

export class ProjectValidationError extends Error {}

export function parseManagedProjectInput(value: unknown, partial = false): Partial<ManagedProjectInput> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProjectValidationError('请求数据格式不正确')
  }
  const body = value as Record<string, unknown>
  const parsed: Partial<ManagedProjectInput> = {}
  const fields = [
    ['name', '项目名称', 80],
    ['description', '项目介绍', 500],
    ['link_url', '项目链接', 1000],
    ['github_url', 'GitHub 仓库地址', 1000],
  ] as const
  for (const [key, label, maxLength] of fields) {
    if (body[key] === undefined && partial) continue
    const raw = body[key] === undefined ? (key === 'name' ? undefined : '') : body[key]
    if (typeof raw !== 'string') throw new ProjectValidationError(`${label}格式不正确`)
    const text = raw.trim()
    if (key === 'name' && !text) throw new ProjectValidationError('项目名称不能为空')
    if (text.length > maxLength) throw new ProjectValidationError(`${label}内容过长`)
    parsed[key] = text
  }
  for (const field of ['link_url', 'github_url'] as const) {
    if (!parsed[field]) continue
    let url: URL
    try { url = new URL(parsed[field]) } catch {
      throw new ProjectValidationError('请输入有效的项目链接')
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ProjectValidationError('项目链接必须以 http:// 或 https:// 开头')
    }
    if (field === 'github_url' && !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) {
      throw new ProjectValidationError('GitHub 仓库地址必须指向 github.com')
    }
    parsed[field] = url.toString()
  }
  if (body.is_visible !== undefined || !partial) {
    const visible = body.is_visible === undefined ? 1 : body.is_visible
    if (![0, 1, false, true].includes(visible as number | boolean)) {
      throw new ProjectValidationError('展示状态格式不正确')
    }
    parsed.is_visible = visible === 0 || visible === false ? 0 : 1
  }
  return parsed
}
