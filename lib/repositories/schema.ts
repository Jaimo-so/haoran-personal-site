export type Database = D1Database

// 获取数据库实例（从 Cloudflare Workers 环境）
export function getDB(env: CloudflareEnv) {
  return env.DB
}

// 自动迁移：确保所有表和列存在
// 注意：在 Cloudflare Workers 无状态环境中，进程级标志无效
// 最佳实践：通过 wrangler d1 migrations 管理 schema
// 使用全局标志避免重复执行
let schemaInitialized = false

export async function ensureSchema(db: Database) {
  if (schemaInitialized) return

  try {
    // 安全地添加新列（ALTER TABLE ADD COLUMN 在列已存在时会报错，所以需要 try/catch）
    const columnMigrations = [
      "ALTER TABLE posts ADD COLUMN password TEXT",
      "ALTER TABLE posts ADD COLUMN is_pinned INTEGER DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN is_hidden INTEGER DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN deleted_at INTEGER",
      "ALTER TABLE posts ADD COLUMN cover_image TEXT",
    ]
    for (const sql of columnMigrations) {
      try {
        await db.prepare(sql).run()
      } catch {
        // column already exists
      }
    }
    schemaInitialized = true
  } catch (error: unknown) {
    console.error('Schema migration failed:', error)
  }
}
