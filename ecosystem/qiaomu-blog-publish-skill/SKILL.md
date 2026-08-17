---
name: qiaomu-blog-publish
description: 将 Markdown 文件、文本内容或 URL 发布到自己的 Qiaomu Blog，支持分类选择、状态控制、本地和远程图片自动上传
trigger: /qiaomu-blog-publish
user_invocable: true
---

# qiaomu-blog-publish: 发布内容到 Qiaomu Blog

## 触发方式

**Slash command:**

- `/qiaomu-blog-publish path/to/file.md`
- `/qiaomu-blog-publish https://example.com/article`
- `/qiaomu-blog-publish` 然后粘贴 Markdown 或正文

**自然语言：**

- “发布到博客”
- “发布成草稿”
- “发到 Qiaomu Blog”
- “把这篇文章发到自己的博客”
- “publish to blog”
- “publish draft”

## 配置

**API Base URL:** `https://your-domain.com`

**Token 读取优先级：**

1. 环境变量 `QIAOMU_BLOG_API_TOKEN`
2. 环境变量 `QMBLOG_API_TOKEN`（兼容旧配置）
3. 配置文件 `~/.claude/skills/qiaomu-blog-publish/config.json`

如果没有 token，提示用户：

1. 打开 `https://your-domain.com/admin/settings`
2. 在 `API Token` 页面生成 token
3. 保存到：

```json
{
  "apiUrl": "https://your-domain.com",
  "token": "qm_xxx"
}
```

## 工作流

### 1. 判断输入来源

- 文件路径：读取本地 Markdown 或文本文件
- URL：抓取正文并转成 Markdown
- 纯文本：直接作为正文使用

### 2. 读取配置

优先读取环境变量；如果没有，再读取 `config.json` 中的 `apiUrl` 和 `token`。

### 3. 拉取分类

```bash
curl -s "https://your-domain.com/api/admin/categories" \
  -H "Authorization: Bearer $TOKEN"
```

让用户选择分类；如果不选，可以留空，后续再在后台调整。

### 4. 解析内容

标题优先级：

1. YAML frontmatter 的 `title`
2. 第一条 `# Heading`
3. 文件名

正文处理：

- 去掉 frontmatter
- 如果标题来自第一条 `# Heading`，则移除这条 heading，避免重复
- 其余 Markdown 原样保留

### 5. 上传本地媒体

需要识别这些引用：

- `![alt](./image.png)`
- `![[image.png]]`
- 音频 / 视频 / 附件本地路径

上传接口：

```bash
curl -s -X POST "https://your-domain.com/api/uploads" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/absolute/path/to/file"
```

拿到返回 URL 后，替换正文中的本地引用。

### 6. 转存第三方图片

如果 Markdown 中有第三方远程图片：

1. 先下载到临时文件
2. 再上传到博客
3. 替换成博客自己的图片 URL

如果下载失败，保留原图 URL，并在最终结果里提示。

### 7. 让用户确认发布参数

确认三件事：

1. 标题
2. 分类
3. 状态：`draft` 或 `published`

默认用 `draft`。

### 8. 发布

```bash
curl -s -X POST "https://your-domain.com/api/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Title",
    "content": "Full processed Markdown content",
    "category": "selected-category-or-empty",
    "status": "draft"
  }'
```

### 9. 输出结果

```text
Published successfully!

Title: xxx
Status: draft
Category: xxx
Edit: https://your-domain.com/editor?slug=2026-04-16-abc123
View: https://your-domain.com/posts/2026-04-16-abc123
Files: Uploaded N files
```

## 错误处理

- 没有 token：提示去后台生成
- `401`：提示 token 失效或错误
- 上传失败：保留原始引用并提示失败项
- 抓取 URL 失败：提示用户直接粘贴正文
- 内容为空：终止并要求补充内容

## 说明

- 默认发布为草稿
- 支持图片、音频、视频、PDF、Epub 等常见文件上传
- 适合和这个仓库里的 `ecosystem/chrome-clipper`、`ecosystem/obsidian-publisher` 一起使用
