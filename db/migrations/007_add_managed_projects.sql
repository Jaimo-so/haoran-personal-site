-- 首页项目管理；初始化标记确保删除的初始项目不会在重新执行迁移时恢复。
CREATE TABLE IF NOT EXISTS managed_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_managed_projects_sort ON managed_projects(sort_order, id);

INSERT OR IGNORE INTO managed_projects (id, name, description, sort_order)
SELECT 1, 'AI 产品拆解', '从用户问题、交互路径和商业价值出发，理解一个 AI 产品为什么成立。', 10
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'managed_projects_initialized');
INSERT OR IGNORE INTO managed_projects (id, name, description, sort_order)
SELECT 2, '原型与实验', '把想法变成可验证的原型，用真实反馈校准需求判断与产品方案。', 20
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'managed_projects_initialized');
INSERT OR IGNORE INTO managed_projects (id, name, description, sort_order)
SELECT 3, '学习与复盘', '记录模型能力、行业认知与求职实践，沉淀可复用的方法和判断。', 30
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE key = 'managed_projects_initialized');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('managed_projects_initialized', '1');
