import { ensureSchema, type Database } from '@/lib/repositories/schema'
import type { SettingRow } from '@/lib/repositories/types'

// ── 站点设置 ──
export async function getSetting(db: Database, key: string): Promise<string | null> {
  await ensureSchema(db)
  try {
    const row = await db
      .prepare('SELECT value FROM site_settings WHERE key = ?')
      .bind(key)
      .first<SettingRow>()
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function setSetting(db: Database, key: string, value: string): Promise<void> {
  await ensureSchema(db)
  await db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').bind(key, value).run()
}
