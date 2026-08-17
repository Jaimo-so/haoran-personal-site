#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${REPO_ROOT}/wrangler.local.toml" ]]; then
  printf '%s\n' "${REPO_ROOT}/wrangler.local.toml"
else
  printf '%s\n' "${REPO_ROOT}/wrangler.toml"
fi

