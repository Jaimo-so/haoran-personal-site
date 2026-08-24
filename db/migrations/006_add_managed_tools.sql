-- 可编辑工具管理：支持增删改、显示状态与展示顺序。
CREATE TABLE IF NOT EXISTS managed_tools (
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
);

CREATE INDEX IF NOT EXISTS idx_managed_tools_sort
  ON managed_tools(sort_order, id);

INSERT OR IGNORE INTO managed_tools
  (name, category, description, link_url, icon, sort_order, is_visible)
VALUES
  (
    '网页剪藏工具',
    'Chrome 扩展',
    '从 Chrome 提取网页正文与图片，并一键保存到博客草稿箱。',
    'https://github.com/Jaimo-so/haoran-personal-site/tree/main/ecosystem/chrome-clipper',
    'globe',
    10,
    1
  ),
  (
    'Obsidian 发布工具',
    'Obsidian 插件',
    '把 Obsidian 笔记及本地媒体文件直接发布到博客草稿箱。',
    'https://github.com/Jaimo-so/haoran-personal-site/tree/main/ecosystem/obsidian-publisher',
    'book',
    20,
    1
  ),
  (
    'AI 发布 Skill',
    'AI Skill',
    '通过 AI 或命令工作流发布 Markdown、纯文本和网页内容。',
    'https://github.com/Jaimo-so/haoran-personal-site/tree/main/ecosystem/qiaomu-blog-publish-skill',
    'bot',
    30,
    1
  );
