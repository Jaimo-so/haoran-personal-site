-- AI 操作表：编辑器 Ask AI 面板的预设操作
CREATE TABLE IF NOT EXISTS ai_actions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  action_key   TEXT UNIQUE NOT NULL,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  prompt       TEXT NOT NULL,
  temperature  REAL DEFAULT 0.6,
  sort_order   INTEGER DEFAULT 0,
  is_enabled   INTEGER DEFAULT 1,
  is_builtin   INTEGER DEFAULT 1,
  created_at   INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at   INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 初始化 6 个内置操作（sort_order 间隔 10，预留插入空间）
INSERT INTO ai_actions
  (action_key, label, description, prompt, temperature, sort_order, is_builtin)
VALUES
  ('improve', '润色', '让表达更顺更自然',
   '你是专业的中文写作助手。对下面的文字进行润色，让表达更顺畅自然，保持原意、语气和信息密度不变，直接返回润色后的文字，不要解释。',
   0.6, 10, 1),

  ('shorten', '缩写', '压缩成更短版本',
   '你是专业的中文写作助手。在不丢失核心意思的前提下，把下面的文字压缩得更简短精炼，直接返回结果，不要解释。',
   0.6, 20, 1),

  ('expand', '扩写', '补充为更完整表述',
   '你是专业的中文写作助手。对下面的文字进行扩写，让表达更完整自然，保持原有风格和语气，直接返回结果，不要解释。',
   0.6, 30, 1),

  ('summarize', '总结', '提炼为清晰摘要',
   '你是专业的中文写作助手。把下面的文字总结为简洁清晰的摘要，直接返回结果，不要解释。',
   0.6, 40, 1),

  ('translate_zh', '译成中文', '翻成简体中文',
   '你是专业翻译。把下面的内容翻译成简体中文，保持原文风格，直接返回翻译结果，不要解释。',
   0.2, 50, 1),

  ('translate_en', '译成英文', '翻成自然英文',
   '你是专业翻译。把下面的内容翻译成自然流畅的英文，保持原文风格，直接返回翻译结果，不要解释。',
   0.2, 60, 1);
