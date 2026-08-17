# 部署指南

Qiaomu Blog Open Source 的正式部署方式是 `OpenNext + Cloudflare Workers`。

## 首次部署

### 1. 安装依赖和环境变量

```bash
npm install
cp .env.example .env.local
```

至少填写：

```env
ADMIN_PASSWORD=change-me
ADMIN_TOKEN_SALT=change-me-to-a-random-string
AI_CONFIG_ENCRYPTION_SECRET=change-me-to-another-random-string
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 初始化资源

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

如果还要启用公共缓存 KV：

```bash
npm run cf:init -- --site-url=https://your-domain.com --with-kv
```

这一步会生成本地的 `wrangler.local.toml`，并自动写入真实 D1 / R2 / KV 绑定。

### 4. 设置 secrets

```bash
npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
npx wrangler secret put AI_CONFIG_ENCRYPTION_SECRET -c wrangler.local.toml
```

如需外部 AI：

```bash
npx wrangler secret put AI_API_KEY -c wrangler.local.toml
```

### 5. 生成类型并部署

```bash
npm run cf-typegen
npm run build
npm run deploy
```

## 本地 Worker 预览

```bash
npm run preview
```

脚本会优先读取 `wrangler.local.toml`。模板仓库里的 `wrangler.toml` 不带真实资源绑定，不能直接拿来部署生产。

## 日常更新

```bash
git pull
npm install
npm run verify
npm run deploy
```

## 常见问题

### `npm run deploy` 报缺少 D1 或 R2

先执行：

```bash
npm run cf:init -- --site-url=https://your-domain.com
```

### 后台登录提示鉴权未配置完成

至少补齐：

```bash
npx wrangler secret put ADMIN_PASSWORD -c wrangler.local.toml
npx wrangler secret put ADMIN_TOKEN_SALT -c wrangler.local.toml
```

### AI Provider 已保存的 Key 无法解密

通常是 `AI_CONFIG_ENCRYPTION_SECRET` 或 `ADMIN_TOKEN_SALT` 被改了。建议固定 `AI_CONFIG_ENCRYPTION_SECRET`，不要和 token salt 复用。

### RSS / sitemap / canonical 指向错域名

检查：

- `.env.local`
- `wrangler.local.toml`

两处的 `NEXT_PUBLIC_SITE_URL` 必须一致。
