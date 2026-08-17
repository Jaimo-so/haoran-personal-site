#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <wrangler-config-path>" >&2
  exit 1
fi

CONFIG_PATH="$1"

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "❌ Wrangler config not found: ${CONFIG_PATH}" >&2
  exit 1
fi

require_binding() {
  local section_pattern="$1"
  local binding_pattern="$2"
  local description="$3"

  if ! rg -q "^[[:space:]]*${section_pattern}[[:space:]]*$" "${CONFIG_PATH}"; then
    echo "❌ Missing ${description} section in ${CONFIG_PATH}" >&2
    exit 1
  fi

  if ! rg -q "^[[:space:]]*${binding_pattern}[[:space:]]*$" "${CONFIG_PATH}"; then
    echo "❌ Missing ${description} binding in ${CONFIG_PATH}" >&2
    exit 1
  fi
}

require_binding "\\[\\[d1_databases\\]\\]" 'binding = "DB"' "D1"
require_binding "\\[\\[r2_buckets\\]\\]" 'binding = "IMAGES"' "R2"

if ! rg -q 'NEXT_PUBLIC_SITE_URL[[:space:]]*=[[:space:]]*"https?://[^"]+"' "${CONFIG_PATH}"; then
  echo "❌ Missing NEXT_PUBLIC_SITE_URL in ${CONFIG_PATH}" >&2
  exit 1
fi

if rg -q 'NEXT_PUBLIC_SITE_URL[[:space:]]*=[[:space:]]*"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|example\.com)(:[0-9]+)?/?\"' "${CONFIG_PATH}"; then
  echo "❌ NEXT_PUBLIC_SITE_URL points to a local or placeholder host in ${CONFIG_PATH}" >&2
  exit 1
fi

echo "==> validated Cloudflare bindings in ${CONFIG_PATH}"
