# 个性化清单

## 1. 修改个人信息

打开 `lib/personal-site.ts`，依次替换：

- `siteName`：网站名称，会显示在导航、页脚和 SEO 信息中。
- `ownerName`：你的真实姓名，会用于文章作者和结构化数据。
- `role`：当前身份与目标岗位。
- `headline`：首页主标题，建议表达你希望解决的产品问题。
- `introduction`：两句话以内的自我介绍。
- `description`：搜索引擎和社交分享使用的网站描述。

## 2. 修改关注方向

首页的三个方向卡片位于 `components/themes/HomeVariantA.tsx` 的 `focusAreas`。可以替换为真实项目，并在后续为每个项目增加详情页。

## 3. 修改导航

首次部署时的默认导航位于 `db/seed-template.sql`。部署后也可以在后台设置页直接维护导航链接。

## 4. 设置域名与密钥

复制 `.env.example` 为 `.env.local`，至少准备：

- `NEXT_PUBLIC_SITE_URL`：你的正式域名。
- `ADMIN_PASSWORD`：后台登录密码。
- `ADMIN_TOKEN_SALT`：管理员 Token 签名盐。
- `AI_CONFIG_ENCRYPTION_SECRET`：AI 配置加密密钥。
- `AI_API_KEY`：可选，仅在使用 AI 能力时配置。

生产部署前必须把 `NEXT_PUBLIC_SITE_URL` 改为真实域名，否则 SEO 链接会继续使用占位地址。

## 5. 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

常用入口：

- 首页：`/`
- 后台：`/admin`
- 编辑器：`/editor`
