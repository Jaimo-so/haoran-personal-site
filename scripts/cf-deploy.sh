#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_PATH="$(bash "${SCRIPT_DIR}/cf-config.sh")"

cd "${REPO_ROOT}"

echo "==> using wrangler config: ${CONFIG_PATH}"
bash "${SCRIPT_DIR}/cf-validate-config.sh" "${CONFIG_PATH}"

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
