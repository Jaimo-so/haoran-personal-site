#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_PATH="$(bash "${SCRIPT_DIR}/cf-config.sh")"

cd "${REPO_ROOT}"

echo "==> using wrangler config: ${CONFIG_PATH}"
bash "${SCRIPT_DIR}/cf-validate-config.sh" "${CONFIG_PATH}"

# Next.js embeds NEXT_PUBLIC_* values during the build, before Wrangler loads
# its variables. Use the same URL for the build and the deployed Worker.
NEXT_PUBLIC_SITE_URL="$(node -e 'const fs = require("fs"); const config = fs.readFileSync(process.argv[1], "utf8"); const match = config.match(/^NEXT_PUBLIC_SITE_URL\s*=\s*"([^"]+)"\s*$/m); if (!match) process.exit(1); process.stdout.write(match[1]);' "${CONFIG_PATH}")"
export NEXT_PUBLIC_SITE_URL

rm -rf .next .open-next
npx opennextjs-cloudflare build

echo "==> applying D1 schema"
npx wrangler d1 execute DB \
  --remote \
  --file="${REPO_ROOT}/db/schema.sql" \
  -c "${CONFIG_PATH}"

if [[ -f "${REPO_ROOT}/db/seed-template.sql" ]]; then
  echo "==> applying template defaults"
  npx wrangler d1 execute DB \
    --remote \
    --file="${REPO_ROOT}/db/seed-template.sql" \
    -c "${CONFIG_PATH}"
fi

npx opennextjs-cloudflare deploy -c "${CONFIG_PATH}"
