# 性能优化记录

## 问题诊断

### 1. MaxListenersExceededWarning
**原因**：Next.js 默认使用 11 个 worker 进程进行并行构建，超过了 Node.js 默认的 10 个事件监听器限制。

**解决方案**：
- 在 `next.config.ts` 中限制 worker 数量为 4
- 禁用 worker threads 以减少内存开销

```typescript
experimental: {
  workerThreads: false,
  cpus: 4,
}
```

### 2. TLS/ECONNRESET 错误
**原因**：Wrangler 尝试连接 `tail.developers.workers.dev` 进行实时日志推送时网络超时。

**解决方案**：
- 在 `package.json` 的 preview 命令中添加 `WRANGLER_SEND_METRICS=false` 环境变量
- 这会禁用遥测和 tail consumer，避免不必要的网络连接

### 3. 页面响应慢
**原因**：
1. 每次请求都执行数据库 schema 迁移检查
2. 远程 D1 数据库延迟（`remote = true`）
3. 没有启用页面缓存

**解决方案**：

#### 3.1 优化数据库迁移逻辑
- 使用 `migrationPromise` 避免并发迁移
- 简化迁移操作，移除不必要的检查
- 使用 `db.batch()` 批量执行 SQL 减少往返次数

```typescript
// 优化前：每次都执行多个独立查询
await db.prepare("CREATE TABLE...").run()
await db.prepare("SELECT...").all()
await db.prepare("ALTER TABLE...").run()

// 优化后：批量执行
await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS..."),
  db.prepare("CREATE TABLE IF NOT EXISTS..."),
])
```

#### 3.2 启用页面缓存
- 首页：60秒缓存 + 部分预渲染（PPR）
- 文章详情页：5分钟缓存 + PPR

```typescript
export const experimental_ppr = true
export const revalidate = 60 // 或 300
```

## 性能指标预期

### 优化前
- 首页加载：~800-1200ms
- 文章详情：~600-1000ms
- 每次请求都执行 schema 检查：~100-200ms

### 优化后
- 首页加载（缓存命中）：~100-200ms
- 文章详情（缓存命中）：~80-150ms
- Schema 检查（首次）：~50ms
- Schema 检查（后续）：0ms（跳过）

## 进一步优化建议

### 1. 使用本地 D1 数据库进行开发
在 `wrangler.toml` 中将 `remote = true` 改为 `remote = false`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "qmblog-db"
database_id = "e0af8dca-153a-4f10-9925-b465f304c5c9"
remote = false  # 开发时使用本地数据库
```

**优点**：
- 延迟从 ~100ms 降到 ~5ms
- 无需网络连接
- 可以离线开发

**缺点**：
- 需要手动同步生产数据到本地（如果需要）

### 2. 使用 Wrangler Migrations
将 `lib/db.ts` 中的 `ensureSchema()` 逻辑移到正式的迁移文件：

```bash
wrangler d1 migrations create qmblog-db add_categories_table
```

**优点**：
- 完全消除运行时 schema 检查开销
- 更规范的数据库版本管理
- 支持回滚

### 3. 添加 KV 缓存层
利用已有的 `CACHE` KV namespace 缓存热门文章：

```typescript
// 伪代码
const cached = await env.CACHE.get(`post:${slug}`)
if (cached) return JSON.parse(cached)

const post = await getPostBySlug(db, slug)
await env.CACHE.put(`post:${slug}`, JSON.stringify(post), {
  expirationTtl: 300 // 5分钟
})
```

### 4. 启用 Cloudflare Cache API
在 API routes 中添加 Cache-Control headers：

```typescript
return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
  }
})
```

## 监控建议

1. 添加性能监控：
   - 使用 `console.time()` / `console.timeEnd()` 记录关键操作耗时
   - 在生产环境启用 Cloudflare Analytics

2. 定期检查：
   - D1 数据库大小和查询性能
   - KV 缓存命中率
   - 页面加载时间（Core Web Vitals）

## 回滚方案

如果优化导致问题，可以快速回滚：

1. 移除 `next.config.ts` 中的 `experimental` 配置
2. 移除页面文件中的 `experimental_ppr` 和 `revalidate`
3. 恢复 `lib/db.ts` 中的原始 `ensureSchema()` 逻辑
