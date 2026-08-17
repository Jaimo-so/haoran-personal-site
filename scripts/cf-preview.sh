#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_PATH="$(bash "${SCRIPT_DIR}/cf-config.sh")"

cd "${REPO_ROOT}"

echo "==> using wrangler config: ${CONFIG_PATH}"
bash "${SCRIPT_DIR}/cf-validate-config.sh" "${CONFIG_PATH}"

pkill -9 -f wrangler 2>/dev/null || true
pkill -9 -f workerd 2>/dev/null || true
sleep 1

rm -rf .next .open-next
npx opennextjs-cloudflare build

preview_cmd=(npx opennextjs-cloudflare preview -c "${CONFIG_PATH}")

if [[ "${PREVIEW_REMOTE:-}" == "1" || "${PREVIEW_REMOTE:-}" == "true" ]]; then
  echo "==> preview mode: remote Cloudflare resources"
  echo "==> warning: this preview can read and write the resources bound in ${CONFIG_PATH}"
  preview_cmd+=(--remote)
else
  echo "==> preview mode: local runtime with binding modes from ${CONFIG_PATH}"
  echo "==> note: bindings marked remote in Wrangler will use live resources; other bindings still use local state"

  if [[ ! -f "${REPO_ROOT}/.dev.vars" && ( -z "${ADMIN_PASSWORD:-}" || -z "${ADMIN_TOKEN_SALT:-}" ) ]]; then
    echo "==> warning: ADMIN_PASSWORD / ADMIN_TOKEN_SALT are not set in the local shell"
    echo "==> admin login will return 503 in local preview unless you provide these secrets via env or .dev.vars"
  fi
fi

WRANGLER_SEND_METRICS=false "${preview_cmd[@]}"
