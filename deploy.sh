#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${REPO_ROOT}"

echo "🚀 开始部署到 Cloudflare Workers..."
echo "📝 检查 Cloudflare 登录状态..."

if ! npx wrangler whoami &> /dev/null; then
  echo "❌ 未登录 Cloudflare，请先运行: npx wrangler login"
  exit 1
fi

bash "${REPO_ROOT}/scripts/cf-deploy.sh"
