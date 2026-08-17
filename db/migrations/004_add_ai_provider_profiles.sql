-- AI 多配置文件表（API Key 使用加密存储）
CREATE TABLE IF NOT EXISTS ai_provider_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'custom',
  provider_name TEXT NOT NULL DEFAULT '',
  provider_type TEXT NOT NULL DEFAULT 'openai_compatible',
  provider_category TEXT NOT NULL DEFAULT '',
  api_key_url TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 1200,
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  api_key_masked TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 说明：ai_actions.profile_id 列由运行时 API 做兼容补齐（避免重复迁移导致失败）。
