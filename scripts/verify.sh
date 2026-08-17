#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-full}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

echo "==> clean build artifacts"
rm -rf .next .open-next

echo "==> npm run lint"
npm run lint

echo "==> npm run test:run"
npm run test:run

if [[ "${MODE}" == "full" ]]; then
  echo "==> npx @opennextjs/cloudflare@latest build"
  npx @opennextjs/cloudflare@latest build
else
  echo "==> npm run build"
  npm run build
fi

echo "Verification complete (${MODE})."
